import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  type BrandDna,
  type CrawlResult,
  createPartialBrandDna,
  crawlSite,
  defineJob,
  saveBrandDna,
} from '@openlumo/core';
import { assets, brandSources, brands, type Database } from '@openlumo/db';
import type { WorkerDependencies } from '../worker-dependencies';

const THIN_SITE_CHARACTERS = 200;

const logoExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

async function storeLogo(
  { db, storage }: WorkerDependencies,
  brandId: string,
  logo: NonNullable<CrawlResult['logo']>,
): Promise<string> {
  const id = randomUUID();
  const extension = logoExtensions[logo.mimeType] ?? 'bin';
  const storageKey = `brands/${brandId}/${id}.${extension}`;
  await storage.write(storageKey, logo.bytes);
  await db.insert(assets).values({ id, brandId, kind: 'logo', storageKey, mimeType: logo.mimeType });
  return id;
}

async function storeSources(
  deps: WorkerDependencies,
  brandId: string,
  crawl: CrawlResult,
): Promise<string | undefined> {
  const { db } = deps;
  await db.delete(brandSources).where(eq(brandSources.brandId, brandId));
  await db.delete(assets).where(eq(assets.brandId, brandId));
  if (crawl.pages.length > 0) {
    await db.insert(brandSources).values(
      crawl.pages.map((page, index) => ({
        brandId,
        kind: 'page' as const,
        url: page.url,
        text: page.text,
        meta: {
          title: page.title,
          description: page.description,
          openGraph: page.openGraph,
          ...(index === 0 ? { palette: crawl.palette } : {}),
        },
      })),
    );
  }
  if (!crawl.logo) return undefined;
  await db.insert(brandSources).values({ brandId, kind: 'logo', url: crawl.logo.url });
  return storeLogo(deps, brandId, crawl.logo);
}

function partialName(crawl: CrawlResult, fallback: string): string {
  const first = crawl.pages[0];
  return first?.openGraph['og:site_name'] || first?.title || fallback;
}

async function savePartialDna(db: Database, brandId: string, dna: BrandDna): Promise<void> {
  await saveBrandDna(db, brandId, dna);
  await db.update(brands).set({ status: 'needs_input' }).where(eq(brands.id, brandId));
}

export function createBrandCrawlJob(deps: WorkerDependencies) {
  const { db, config } = deps;
  return defineJob('brand.crawl', async ({ brandId }, context) => {
    await context.reportProgress('Reading your site');
    const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
    if (!brand?.url) throw new Error(`Brand ${brandId} has no URL to crawl`);

    const crawl = await crawlSite(brand.url, { allowPrivateHosts: config.allowPrivateHosts }).catch(
      (): CrawlResult => ({ pages: [], palette: [] }),
    );
    const logoAssetId = await storeSources(deps, brandId, crawl);

    const totalText = crawl.pages.reduce((sum, page) => sum + page.text.length, 0);
    if (totalText < THIN_SITE_CHARACTERS) {
      const partial = createPartialBrandDna({
        name: partialName(crawl, brand.name),
        palette: crawl.palette,
        ...(logoAssetId ? { logoAssetId } : {}),
      });
      await savePartialDna(db, brandId, partial);
      return;
    }

    await context.enqueue('brand.synthesize-dna', { brandId });
  });
}
