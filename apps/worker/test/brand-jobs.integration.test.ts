import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Config,
  type JobContext,
  createAssetStorage,
  createBrand,
  getBrandDna,
  loadConfig,
} from '@openlumo/core';
import { assets, brandMembers, brandSources, brands, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { ProviderError } from '@openlumo/providers';
import { fakeResponses } from '../../../packages/core/src/models/fake-responses';
import { createBrandCrawlJob } from '../src/jobs/brand-crawl';
import { createBrandSynthesizeDnaJob } from '../src/jobs/brand-synthesize-dna';

const siteDir = fileURLToPath(
  new URL('../../../packages/core/test-fixtures/site/', import.meta.url),
);
const types: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.png': 'image/png',
  '.txt': 'text/plain',
};

const thinPage = `<html><head><title>Acme Tools</title><meta property="og:site_name" content="Acme Tools"><style>a { color: #ff5a1f; } b { color: #ff5a1f; }</style></head><body><div id=root></div></body></html>`;

function startServer(handler: http.RequestListener): Promise<{ origin: string; server: http.Server }> {
  const server = http.createServer(handler);
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server }),
    ),
  );
}

describe('brand jobs', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let storageDirectory: string;
  let config: Config;
  let fixtureOrigin: string;
  let thinOrigin: string;
  const servers: http.Server[] = [];
  const enqueued: Array<{ name: string; payload: unknown }> = [];

  const context: JobContext = {
    runId: 'run',
    signal: new AbortController().signal,
    reportProgress: async () => {},
    recordUsage: async () => {},
    enqueue: async (name, payload) => {
      enqueued.push({ name, payload });
      return 'queued';
    },
  };

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    storageDirectory = await mkdtemp(path.join(tmpdir(), 'openlumo-brand-'));
    config = {
      ...loadConfig({
        DATABASE_URL: 'postgres://unused',
        APP_SECRET: 'x'.repeat(32),
        PUBLIC_URL: 'http://localhost:3000',
        CRAWLER_ALLOW_PRIVATE_HOSTS: 'true',
        OPENLUMO_TEST_PROVIDERS: 'fake',
      }),
    };
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });

    const fixture = await startServer(async (req, res) => {
      const pathname = new URL(req.url ?? '/', 'http://x').pathname;
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      try {
        const body = await readFile(path.join(siteDir, file));
        res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    const thin = await startServer((req, res) => {
      if ((req.url ?? '/') === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(thinPage);
      } else res.writeHead(404).end();
    });
    servers.push(fixture.server, thin.server);
    fixtureOrigin = fixture.origin;
    thinOrigin = thin.origin;
  });

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
    await rm(storageDirectory, { recursive: true, force: true });
    await drop();
  });

  function deps() {
    return { db, config, storage: createAssetStorage(storageDirectory) };
  }

  async function brandStatus(id: string) {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand!.status;
  }

  it('crawls the fixture site, stores sources and logo, then synthesises a ready DNA', async () => {
    enqueued.length = 0;
    const brand = await createBrand(db, { url: `${fixtureOrigin}/`, createdBy: 'u1' });
    expect(brand.status).toBe('crawling');

    await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);
    expect(enqueued).toEqual([{ name: 'brand.synthesize-dna', payload: { brandId: brand.id } }]);

    const sources = await db.select().from(brandSources).where(eq(brandSources.brandId, brand.id));
    expect(sources.filter((source) => source.kind === 'page').length).toBeGreaterThan(1);
    expect(sources.filter((source) => source.kind === 'logo')).toHaveLength(1);
    const [logo] = await db.select().from(assets).where(eq(assets.brandId, brand.id));
    expect(logo?.kind).toBe('logo');
    expect(logo?.storageKey).toBe(`brands/${brand.id}/${logo!.id}.png`);
    expect((await deps().storage.read(logo!.storageKey)).length).toBeGreaterThan(0);

    await createBrandSynthesizeDnaJob(deps()).run({ brandId: brand.id }, context);
    expect(await brandStatus(brand.id)).toBe('ready');
    const saved = await getBrandDna(db, brand.id);
    expect(saved?.dna.identity.name).toBe('Sunrise Bakery');
    expect(saved?.dna.visuals.logoAssetId).toBe(logo!.id);
    expect(saved?.dna.visuals.palette[0]).toBe('#ff5a1f');
  });

  it('saves a prefilled partial DNA and needs_input for a thin site', async () => {
    enqueued.length = 0;
    const brand = await createBrand(db, { url: `${thinOrigin}/`, createdBy: 'u1' });

    await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);

    expect(enqueued).toEqual([]);
    expect(await brandStatus(brand.id)).toBe('needs_input');
    const saved = await getBrandDna(db, brand.id);
    expect(saved?.dna.identity.name).toBe('Acme Tools');
    expect(saved?.dna.visuals.palette).toContain('#ff5a1f');
  });

  it('saves a partial DNA and needs_input when the URL is unreachable', async () => {
    enqueued.length = 0;
    const closed = await startServer(() => {});
    const unreachable = closed.origin;
    await new Promise((resolve) => closed.server.close(resolve));
    const brand = await createBrand(db, { name: 'Ghost Co', url: `${unreachable}/`, createdBy: 'u1' });

    await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);

    expect(enqueued).toEqual([]);
    expect(await brandStatus(brand.id)).toBe('needs_input');
    expect((await getBrandDna(db, brand.id))?.dna.identity.name).toBe('Ghost Co');
  });

  it('falls back to prefilled manual input when synthesis fails non-retryably', async () => {
    enqueued.length = 0;
    const brand = await createBrand(db, { url: `${fixtureOrigin}/`, createdBy: 'u1' });
    await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);
    const original = fakeResponses.brand_dna!;
    fakeResponses.brand_dna = () => {
      throw new ProviderError('unauthorized');
    };
    const job = createBrandSynthesizeDnaJob(deps());
    try {
      await expect(job.run({ brandId: brand.id }, context)).rejects.toMatchObject({ code: 'unauthorized' });
    } finally {
      fakeResponses.brand_dna = original;
    }

    await job.onFailed!({ brandId: brand.id }, { code: 'unauthorized', message: 'unauthorized' });

    expect(await brandStatus(brand.id)).toBe('needs_input');
    const saved = await getBrandDna(db, brand.id);
    expect(saved?.dna.identity.name).toBe('Sunrise Bakery');
    expect(saved?.dna.visuals.palette[0]).toBe('#ff5a1f');
    expect(saved?.dna.visuals.logoAssetId).toBeTruthy();
  });

  it('createBrand without a URL needs input and adds the creator as owner', async () => {
    const brand = await createBrand(db, { name: 'Manual Co', createdBy: 'u1' });
    expect(brand.status).toBe('needs_input');
    const members = await db.select().from(brandMembers).where(eq(brandMembers.brandId, brand.id));
    expect(members).toEqual([{ brandId: brand.id, userId: 'u1', role: 'owner' }]);
  });
});
