import { and, eq } from 'drizzle-orm';
import {
  defineJob,
  loadCrawlSources,
  resolveModels,
  saveBrandDna,
  synthesizeBrandDna,
} from '@openlumo/core';
import { assets, brands } from '@openlumo/db';
import { fallBackToManualInput } from './brand-fallback';
import type { WorkerDependencies } from '../worker-dependencies';

export function createBrandSynthesizeDnaJob({ db, config }: WorkerDependencies) {
  return defineJob(
    'brand.synthesize-dna',
    async ({ brandId }, context) => {
      await context.reportProgress('Learning your brand');

      const crawl = (await loadCrawlSources(db, brandId)) ?? { pages: [], palette: [] };

      const { brain } = await resolveModels(db, config);
      const { dna, usage } = await synthesizeBrandDna(brain.model, brain.modelId, crawl, []);
      await context.recordUsage(usage);

      const [logo] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.brandId, brandId), eq(assets.kind, 'logo')));
      await saveBrandDna(db, brandId, logo ? { ...dna, visuals: { ...dna.visuals, logoAssetId: logo.id } } : dna);
      await db.update(brands).set({ status: 'ready' }).where(eq(brands.id, brandId));
    },
    { onFailed: ({ brandId }) => fallBackToManualInput(db, brandId) },
  );
}
