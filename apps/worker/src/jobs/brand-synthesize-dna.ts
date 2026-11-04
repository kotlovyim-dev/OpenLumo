import {
  defineJob,
  loadCrawlSources,
  resolveModels,
  saveBrandDna,
  setBrandStatus,
  synthesizeBrandDna,
} from '@openlumo/core';
import { fallBackToManualInput } from './brand-fallback';
import type { WorkerDependencies } from '../worker-dependencies';

export function createBrandSynthesizeDnaJob({ db, config }: WorkerDependencies) {
  return defineJob(
    'brand.synthesize-dna',
    async ({ brandId }, context) => {
      await context.reportProgress('Learning your brand');

      const crawl = (await loadCrawlSources(db, brandId)) ?? { pages: [], palette: [], logoAssetId: undefined };

      const { brain } = await resolveModels(db, config);
      const { dna, usage } = await synthesizeBrandDna(brain.model, brain.modelId, crawl, []);
      await context.recordUsage(usage);

      await saveBrandDna(db, brandId, crawl.logoAssetId ? { ...dna, visuals: { ...dna.visuals, logoAssetId: crawl.logoAssetId } } : dna);
      await setBrandStatus(db, brandId, 'ready');
    },
    { onFailed: ({ brandId }) => fallBackToManualInput(db, brandId) },
  );
}
