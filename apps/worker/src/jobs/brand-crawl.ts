import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  type CrawlResult,
  crawlSite,
  defineJob,
} from '@openlumo/core';
import { assets, brandSources, brands } from '@openlumo/db';
import { fallBackToManualInput } from './brand-fallback';
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

type Transaction = Parameters<Parameters<WorkerDependencies['db']['transaction']>[0]>[0];

async function storeLogo(
  tx: Transaction,
  storage: WorkerDependencies['storage'],
  brandId: string,
  logo: NonNullable<CrawlResult['logo']>,
): Promise<void> {
  const id = randomUUID();
  const extension = logoExtensions[logo.mimeType] ?? 'bin';
  const storageKey = `brands/${brandId}/${id}.${extension}`;
  await storage.write(storageKey, logo.bytes);
  await tx.insert(assets).values({ id, brandId, kind: 'logo', storageKey, mimeType: logo.mimeType });
}

async function storeSources(
  { db, storage }: WorkerDependencies,
  brandId: string,
  crawl: CrawlResult,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(brandSources).where(eq(brandSources.brandId, brandId));
    await tx.delete(assets).where(eq(assets.brandId, brandId));
    if (crawl.pages.length > 0) {
      await tx.insert(brandSources).values(
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
    if (!crawl.logo) return;
    await tx.insert(brandSources).values({ brandId, kind: 'logo', url: crawl.logo.url });
    await storeLogo(tx, storage, brandId, crawl.logo);
  });
}

export function createBrandCrawlJob(deps: WorkerDependencies) {
  const { db, config } = deps;
  return defineJob(
    'brand.crawl',
    async ({ brandId }, context) => {
      await context.reportProgress('Reading your site');
      const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
      if (!brand?.url) throw new Error(`Brand ${brandId} has no URL to crawl`);

      const crawl = await crawlSite(brand.url, { allowPrivateHosts: config.allowPrivateHosts }).catch(
        (error): CrawlResult => {
          console.error(`Crawl of ${brand.url} failed`, error);
          return { pages: [], palette: [] };
        },
      );
      await storeSources(deps, brandId, crawl);

      const totalText = crawl.pages.reduce((sum, page) => sum + page.text.length, 0);
      if (totalText < THIN_SITE_CHARACTERS) {
        await fallBackToManualInput(db, brandId);
        return;
      }

      await context.enqueue(
        'brand.synthesize-dna',
        { brandId },
        { idempotencyKey: `synthesize-dna:${context.runId}` },
      );
    },
    { onFailed: ({ brandId }) => fallBackToManualInput(db, brandId) },
  );
}
