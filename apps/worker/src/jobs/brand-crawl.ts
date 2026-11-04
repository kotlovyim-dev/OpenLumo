import {
  type CrawlResult,
  crawlSite,
  defineJob,
  findBrand,
  saveCrawlSources,
} from '@openlumo/core';
import { fallBackToManualInput } from './brand-fallback';
import type { WorkerDependencies } from '../worker-dependencies';

const THIN_SITE_CHARACTERS = 200;

export function createBrandCrawlJob(deps: WorkerDependencies) {
  const { db, config, storage } = deps;
  return defineJob(
    'brand.crawl',
    async ({ brandId }, context) => {
      await context.reportProgress('Reading your site');
      const brand = await findBrand(db, brandId);
      if (!brand?.url) throw new Error(`Brand ${brandId} has no URL to crawl`);

      const crawl = await crawlSite(brand.url, { allowPrivateHosts: config.allowPrivateHosts }).catch(
        (error): CrawlResult => {
          console.error(`Crawl of ${brand.url} failed`, error);
          return { pages: [], palette: [] };
        },
      );
      await saveCrawlSources(db, storage, brandId, crawl);

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
