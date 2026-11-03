import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { assets, brandSources, brands, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createAssetStorage, type AssetStorage } from '../../src/assets/asset-storage';
import type { CrawlResult } from '../../src/crawl/crawl-site';
import { loadCrawlSources, saveCrawlSources } from '../../src/crawl/crawl-sources';

function page(url: string, title: string): CrawlResult['pages'][number] {
  return {
    url,
    title,
    description: `${title} description`,
    text: `${title} text`,
    links: [],
    imageUrls: [],
    stylesheetUrls: [],
    inlineCss: '',
    openGraph: { 'og:site_name': title },
  };
}

describe('crawl sources', { timeout: 30_000 }, () => {
  let db: Database;
  let drop: () => Promise<void>;
  let directory: string;
  let storage: AssetStorage;
  let brandId: string;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    directory = await mkdtemp(join(tmpdir(), 'openlumo-crawl-sources-'));
    storage = createAssetStorage(directory);
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
    const [brand] = await db.insert(brands).values({ name: 'B', createdBy: 'u1' }).returning({ id: brands.id });
    brandId = brand!.id;
  });

  afterAll(async () => {
    await drop();
    await rm(directory, { recursive: true, force: true });
  });

  it('returns null before anything is saved', async () => {
    expect(await loadCrawlSources(db, brandId)).toBeNull();
  });

  it('round-trips pages, palette and the stored logo', async () => {
    const crawl: CrawlResult = {
      pages: [page('https://example.com/', 'Home'), page('https://example.com/about', 'About')],
      palette: ['#112233', '#445566'],
      logo: { url: 'https://example.com/logo.png', bytes: Uint8Array.from([1, 2, 3]), mimeType: 'image/png' },
    };

    const { logoAssetId } = await saveCrawlSources(db, storage, brandId, crawl);
    const loaded = await loadCrawlSources(db, brandId);

    expect(loaded?.palette).toEqual(['#112233', '#445566']);
    expect(loaded?.logoAssetId).toBe(logoAssetId);
    expect(loaded?.pages.map(({ url, title, description, text, openGraph }) => ({ url, title, description, text, openGraph })))
      .toEqual(
        crawl.pages.map(({ url, title, description, text, openGraph }) => ({ url, title, description, text, openGraph })),
      );
    const [asset] = await db.select().from(assets).where(eq(assets.brandId, brandId));
    expect(asset?.id).toBe(logoAssetId);
    expect(await storage.read(asset!.storageKey)).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('replaces earlier sources and assets on a second save', async () => {
    const { logoAssetId } = await saveCrawlSources(db, storage, brandId, {
      pages: [page('https://example.com/', 'Home again')],
      palette: [],
    });

    expect(logoAssetId).toBeUndefined();
    expect(await db.select().from(assets).where(eq(assets.brandId, brandId))).toHaveLength(0);
    expect((await loadCrawlSources(db, brandId))?.pages.map((p) => p.title)).toEqual(['Home again']);
  });

  it('treats invalid page meta as empty instead of throwing', async () => {
    await db.update(brandSources).set({ meta: { title: 42, palette: 'red' } }).where(eq(brandSources.brandId, brandId));

    const loaded = await loadCrawlSources(db, brandId);

    expect(loaded?.palette).toEqual([]);
    expect(loaded?.pages[0]).toMatchObject({ title: '', description: '', openGraph: {}, text: 'Home again text' });
  });
});
