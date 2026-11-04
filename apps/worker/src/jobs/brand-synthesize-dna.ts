import {
  BrandNotReadyError,
  type JobContext,
  defineJob,
  getBrandDna,
  listOpenFeedbackNotes,
  loadCrawlSources,
  markFeedbackMerged,
  mergeFeedback,
  resolveModels,
  saveBrandDna,
  saveBrandDnaIfVersion,
  setBrandStatus,
  synthesizeBrandDna,
} from '@openlumo/core';
import { fallBackToManualInput } from './brand-fallback';
import type { WorkerDependencies } from '../worker-dependencies';

async function mergeOpenFeedback({ db, config }: WorkerDependencies, brandId: string, context: JobContext) {
  await context.reportProgress('Applying your feedback');
  const saved = await getBrandDna(db, brandId);
  if (!saved) throw new BrandNotReadyError(brandId);
  const notes = await listOpenFeedbackNotes(db, brandId);
  if (notes.length === 0) return;

  const { brain } = await resolveModels(db, config);
  const { dna, usage } = await mergeFeedback(
    brain.model,
    brain.modelId,
    saved.dna,
    notes.map((note) => note.note),
  );
  await context.recordUsage(usage);
  if (!(await saveBrandDnaIfVersion(db, brandId, dna, saved.version))) {
    console.warn(`Skipped feedback merge for brand ${brandId}: the DNA was edited while merging`);
    return;
  }
  await markFeedbackMerged(
    db,
    brandId,
    notes.map((note) => note.id),
  );
}

export function createBrandSynthesizeDnaJob(deps: WorkerDependencies) {
  const { db, config } = deps;
  return defineJob(
    'brand.synthesize-dna',
    async ({ brandId, mergeFeedback: shouldMerge }, context) => {
      if (shouldMerge) {
        await mergeOpenFeedback(deps, brandId, context);
        return;
      }
      await context.reportProgress('Learning your brand');

      const crawl = (await loadCrawlSources(db, brandId)) ?? { pages: [], palette: [], logoAssetId: undefined };

      const { brain } = await resolveModels(db, config);
      const { dna, usage } = await synthesizeBrandDna(brain.model, brain.modelId, crawl, []);
      await context.recordUsage(usage);

      await saveBrandDna(db, brandId, crawl.logoAssetId ? { ...dna, visuals: { ...dna.visuals, logoAssetId: crawl.logoAssetId } } : dna);
      await setBrandStatus(db, brandId, 'ready');
    },
    {
      onFailed: ({ brandId, mergeFeedback: shouldMerge }) =>
        shouldMerge ? Promise.resolve() : fallBackToManualInput(db, brandId),
    },
  );
}
