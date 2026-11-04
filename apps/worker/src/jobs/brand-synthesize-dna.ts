import {
  BrandNotReadyError,
  type JobContext,
  applyResearch,
  defineJob,
  getBrandDna,
  getResearch,
  listOpenFeedbackNotes,
  loadCrawlSources,
  markFeedbackMerged,
  mergeFeedback,
  normalisePalette,
  resolveModels,
  saveBrandDna,
  saveBrandDnaIfVersion,
  setBrandName,
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
  const { dna: merged, usage } = await mergeFeedback(
    brain.model,
    brain.modelId,
    saved.dna,
    notes.map((note) => note.note),
  );
  await context.recordUsage(usage);
  const dna = { ...merged, visuals: { ...merged.visuals, palette: normalisePalette(merged.visuals.palette) } };
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

      const research = await getResearch(db, brandId);

      const { brain } = await resolveModels(db, config);
      const { dna: synthesized, usage } = await synthesizeBrandDna(brain.model, brain.modelId, crawl, [], research?.brief);
      await context.recordUsage(usage);

      const researched = research?.findings ? applyResearch(synthesized, research.findings) : synthesized;
      const dna = crawl.logoAssetId
        ? { ...researched, visuals: { ...researched.visuals, logoAssetId: crawl.logoAssetId } }
        : researched;
      await saveBrandDna(db, brandId, dna);
      if (dna.identity.name.trim()) await setBrandName(db, brandId, dna.identity.name.trim());
      await setBrandStatus(db, brandId, 'ready');
    },
    {
      onFailed: ({ brandId, mergeFeedback: shouldMerge }) =>
        shouldMerge ? Promise.resolve() : fallBackToManualInput(db, brandId),
    },
  );
}
