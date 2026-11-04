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
  addDnaFeedback,
  createBrand,
  createPartialBrandDna,
  saveBrandDna,
  getBrandDna,
  getResearch,
  listOpenFeedbackNotes,
  loadCrawlSources,
  setBrandStatus,
  loadConfig,
} from '@openlumo/core';
import { assets, brandMembers, brandSources, brands, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { ProviderError } from '@openlumo/providers';
import { fakeResponses } from '../../../packages/core/src/models/fake-responses';
import { createBrandCrawlJob } from '../src/jobs/brand-crawl';
import { createBrandResearchJob } from '../src/jobs/brand-research';
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
const titledThinPage = `<html><head><title>Acme Tools — Hand tools | Built to last</title></head><body><div id=root></div></body></html>`;
const appShellPage = `<html><head><title>Leryo — Lessons for tutors</title>
<meta name="description" content="AI-native workspace for private English tutors. Create interactive lessons from prompts, PDFs, or photos in seconds.">
<meta name="keywords" content="english tutors, ai lesson planner, interactive lessons, tutoring software">
<script type="application/ld+json">{"@type":"WebApplication","name":"Leryo","offers":{"price":"0","description":"Free plan with up to 5 lessons"}}</script>
</head><body><div id=root></div></body></html>`;

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
      const pages: Record<string, string> = { '/': thinPage, '/titled': titledThinPage, '/app': appShellPage };
      const page = pages[req.url ?? '/'];
      if (page) {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(page);
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
    expect(enqueued).toEqual([{ name: 'brand.research', payload: { brandId: brand.id } }]);

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

  it('does not duplicate sources or synthesize runs when the same crawl run is retried', async () => {
    const keys: Array<string | undefined> = [];
    const retryContext: JobContext = {
      ...context,
      runId: 'same-run',
      enqueue: async (_name, _payload, options) => {
        keys.push(options?.idempotencyKey);
        return 'queued';
      },
    };
    const brand = await createBrand(db, { url: `${fixtureOrigin}/`, createdBy: 'u1' });
    const job = createBrandCrawlJob(deps());
    await job.run({ brandId: brand.id }, retryContext);
    const first = await db.select().from(brandSources).where(eq(brandSources.brandId, brand.id));
    await job.run({ brandId: brand.id }, retryContext);
    const second = await db.select().from(brandSources).where(eq(brandSources.brandId, brand.id));

    expect(second).toHaveLength(first.length);
    expect(await db.select().from(assets).where(eq(assets.brandId, brand.id))).toHaveLength(1);
    expect(keys).toEqual(['research:same-run', 'research:same-run']);
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

  it('names a thin site from its page title without the tagline', async () => {
    const brand = await createBrand(db, { url: `${thinOrigin}/titled`, createdBy: 'u1' });

    await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);

    expect((await getBrandDna(db, brand.id))?.dna.identity.name).toBe('Acme Tools');
  });

  it('researches an app shell site whose head describes the business', async () => {
    enqueued.length = 0;
    const brand = await createBrand(db, { url: `${thinOrigin}/app`, createdBy: 'u1' });

    await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);

    expect(enqueued).toEqual([{ name: 'brand.research', payload: { brandId: brand.id } }]);
    const [page] = (await loadCrawlSources(db, brand.id))!.pages;
    expect(page!.text).toBe('');
    expect(page!.metadata).toContain('Free plan with up to 5 lessons');
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

  describe('web research', () => {
    async function crawledBrand() {
      const brand = await createBrand(db, { url: `${fixtureOrigin}/`, createdBy: 'u1' });
      await createBrandCrawlJob(deps()).run({ brandId: brand.id }, context);
      enqueued.length = 0;
      return brand;
    }

    async function researchedBrand() {
      const brand = await createBrand(db, { url: `${fixtureOrigin}/`, createdBy: 'u1' });
      await saveBrandDna(db, brand.id, {
        ...createPartialBrandDna({ name: 'Sunrise Bakery', palette: [] }),
        voice: { tone: { formalToCasual: 2, seriousToPlayful: 2, reservedToBold: 2 }, dos: ['Keep it short'], donts: [], samplePhrases: [] },
      });
      await setBrandStatus(db, brand.id, 'ready');
      enqueued.length = 0;
      return brand;
    }

    async function withFailingResearch(run: () => Promise<void>) {
      const original = fakeResponses.brand_research!;
      fakeResponses.brand_research = () => {
        throw new ProviderError('invalid_output', 'Web plugin not supported');
      };
      try {
        await run();
      } finally {
        fakeResponses.brand_research = original;
      }
    }

    it('stores cited research and queues synthesis', async () => {
      const brand = await crawledBrand();
      const steps: string[] = [];

      await createBrandResearchJob(deps()).run(
        { brandId: brand.id },
        { ...context, reportProgress: async (step) => void steps.push(step) },
      );

      expect(steps).toEqual(['Researching your market']);
      expect(enqueued).toEqual([{ name: 'brand.synthesize-dna', payload: { brandId: brand.id } }]);
      const research = await getResearch(db, brand.id);
      expect(research?.status).toBe('succeeded');
      expect(research?.sources).toEqual([{ url: 'https://example.com/sunrise-bakery-review', title: 'Sunrise Bakery review' }]);
    });

    it('applies the findings to the synthesised DNA and names the brand', async () => {
      const brand = await crawledBrand();
      expect(brand.name).not.toBe('Sunrise Bakery');
      await createBrandResearchJob(deps()).run({ brandId: brand.id }, context);

      await createBrandSynthesizeDnaJob(deps()).run({ brandId: brand.id }, context);

      const saved = await getBrandDna(db, brand.id);
      expect(saved?.dna.competitors.map((competitor) => competitor.name)).toEqual(['Golden Crust Bakery']);
      expect(saved?.dna.identity.features).toContain('Pre-order online by 8pm');
      expect(saved?.dna.audience.channels).toContain('Local food blogs');
      const [renamed] = await db.select().from(brands).where(eq(brands.id, brand.id));
      expect(renamed?.name).toBe('Sunrise Bakery');
    });

    it('takes competitors only from verified research once research ran', async () => {
      const brand = await crawledBrand();
      const originalResearch = fakeResponses.brand_research!;
      const originalDna = fakeResponses.brand_dna!;
      fakeResponses.brand_research = (request) => ({ ...(originalResearch(request) as object), competitors: [] });
      fakeResponses.brand_dna = (request) => ({
        ...(originalDna(request) as object),
        competitors: [{ name: 'Invented Rival', url: 'https://invented.example', positioning: '', strengths: [], weaknesses: [], sourceUrls: [] }],
      });
      try {
        await createBrandResearchJob(deps()).run({ brandId: brand.id }, context);
        await createBrandSynthesizeDnaJob(deps()).run({ brandId: brand.id }, context);
      } finally {
        fakeResponses.brand_research = originalResearch;
        fakeResponses.brand_dna = originalDna;
      }

      expect((await getBrandDna(db, brand.id))?.dna.competitors).toEqual([]);
    });

    it('records failed research and still queues synthesis', async () => {
      const brand = await crawledBrand();

      await withFailingResearch(() => createBrandResearchJob(deps()).run({ brandId: brand.id }, context));

      expect((await getResearch(db, brand.id))?.status).toBe('failed');
      expect(enqueued).toEqual([{ name: 'brand.synthesize-dna', payload: { brandId: brand.id } }]);
      await createBrandSynthesizeDnaJob(deps()).run({ brandId: brand.id }, context);
      expect(await brandStatus(brand.id)).toBe('ready');
      expect((await getBrandDna(db, brand.id))?.dna.competitors).toEqual([]);
    });

    it('refreshes competitors, features and audience and keeps the voice', async () => {
      const brand = await researchedBrand();

      await createBrandResearchJob(deps()).run({ brandId: brand.id, refresh: true }, context);

      const saved = await getBrandDna(db, brand.id);
      expect(saved?.dna.competitors[0]?.name).toBe('Golden Crust Bakery');
      expect(saved?.dna.identity.features).toContain('Pre-order online by 8pm');
      expect(saved?.dna.voice.dos).toEqual(['Keep it short']);
      expect(enqueued).toEqual([]);
    });

    it('keeps an edit saved while the refresh was researching', async () => {
      const brand = await researchedBrand();
      const editDuringResearch = async () => {
        const current = await getBrandDna(db, brand.id);
        await saveBrandDna(db, brand.id, { ...current!.dna, identity: { ...current!.dna.identity, tagline: 'Edited meanwhile' } });
      };

      await createBrandResearchJob(deps()).run({ brandId: brand.id, refresh: true }, { ...context, recordUsage: editDuringResearch });

      const saved = await getBrandDna(db, brand.id);
      expect(saved?.dna.identity.tagline).toBe('Edited meanwhile');
      expect(saved?.dna.competitors[0]?.name).toBe('Golden Crust Bakery');
    });

    it('leaves the DNA untouched when a refresh fails', async () => {
      const brand = await researchedBrand();
      const before = await getBrandDna(db, brand.id);

      await withFailingResearch(() => createBrandResearchJob(deps()).run({ brandId: brand.id, refresh: true }, context));

      expect((await getBrandDna(db, brand.id))?.version).toBe(before!.version);
      expect((await getResearch(db, brand.id))?.status).toBe('failed');
      expect(await brandStatus(brand.id)).toBe('ready');
    });
  });

  describe('feedback merge', () => {
    async function readyBrand() {
      const brand = await createBrand(db, { name: 'Merge Co', createdBy: 'u1' });
      await createBrandSynthesizeDnaJob(deps()).run({ brandId: brand.id }, context);
      await setBrandStatus(db, brand.id, 'ready');
      return brand;
    }

    it('merges open notes into the DNA, bumps the version and marks them merged', async () => {
      const brand = await readyBrand();
      const before = await getBrandDna(db, brand.id);
      await addDnaFeedback(db, brand.id, 'Sound friendlier');
      const steps: string[] = [];
      const original = fakeResponses.merged_brand_dna!;
      fakeResponses.merged_brand_dna = (request) => ({
        ...(original(request) as object),
        identity: { ...(before!.dna.identity), tagline: 'Merged tagline' },
      });
      try {
        await createBrandSynthesizeDnaJob(deps()).run(
          { brandId: brand.id, mergeFeedback: true },
          { ...context, reportProgress: async (step) => void steps.push(step) },
        );
      } finally {
        fakeResponses.merged_brand_dna = original;
      }

      const after = await getBrandDna(db, brand.id);
      expect(after?.dna.identity.tagline).toBe('Merged tagline');
      expect(after?.version).toBe(before!.version + 1);
      expect(await listOpenFeedbackNotes(db, brand.id)).toEqual([]);
      expect(steps).toEqual(['Applying your feedback']);
      expect(await brandStatus(brand.id)).toBe('ready');
    });

    it('leaves a concurrent manual edit and the open notes alone', async () => {
      const brand = await readyBrand();
      await addDnaFeedback(db, brand.id, 'Be bolder');
      const manual = createPartialBrandDna({ name: 'Manual edit', palette: [] });
      await createBrandSynthesizeDnaJob(deps()).run(
        { brandId: brand.id, mergeFeedback: true },
        { ...context, recordUsage: async () => saveBrandDna(db, brand.id, manual) },
      );
      expect((await getBrandDna(db, brand.id))?.dna.identity.name).toBe('Manual edit');
      expect(await listOpenFeedbackNotes(db, brand.id)).toHaveLength(1);
    });

    it('succeeds without a model call or version bump when there are no open notes', async () => {
      const brand = await readyBrand();
      const before = await getBrandDna(db, brand.id);
      const original = fakeResponses.merged_brand_dna!;
      fakeResponses.merged_brand_dna = () => {
        throw new Error('model must not be called');
      };
      try {
        await createBrandSynthesizeDnaJob(deps()).run({ brandId: brand.id, mergeFeedback: true }, context);
      } finally {
        fakeResponses.merged_brand_dna = original;
      }
      expect((await getBrandDna(db, brand.id))?.version).toBe(before!.version);
    });

    it('keeps the brand ready and the notes open when the merge fails', async () => {
      const brand = await readyBrand();
      await addDnaFeedback(db, brand.id, 'Be bolder');
      const job = createBrandSynthesizeDnaJob(deps());
      await job.onFailed!({ brandId: brand.id, mergeFeedback: true }, { code: 'unauthorized', message: 'x' });
      expect(await brandStatus(brand.id)).toBe('ready');
      expect(await listOpenFeedbackNotes(db, brand.id)).toHaveLength(1);
    });
  });
});
