import {
  type JobContext,
  type ResearchFindings,
  applyResearch,
  defineJob,
  findBrand,
  getBrandDna,
  loadCrawlSources,
  recordFailedResearch,
  researchBrand,
  resolveModels,
  saveBrandDnaIfVersion,
  saveResearch,
} from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { fallBackToManualInput } from './brand-fallback';
import type { WorkerDependencies } from '../worker-dependencies';

const APPLY_ATTEMPTS = 3;

async function research(
  { db, config }: WorkerDependencies,
  brandId: string,
  url: string,
  context: JobContext,
): Promise<ResearchFindings | null> {
  try {
    const crawl = (await loadCrawlSources(db, brandId)) ?? { pages: [], palette: [] };
    const { brain } = await resolveModels(db, config);
    const result = await researchBrand(brain.model, brain.modelId, {
      url,
      crawl,
      today: new Date(),
      allowPrivateHosts: config.allowPrivateHosts,
      signal: context.signal,
    });
    await context.recordUsage(result.usage);
    await saveResearch(db, brandId, result);
    return result.findings;
  } catch (error) {
    if (context.signal.aborted) throw error;
    console.error(`Web research for brand ${brandId} failed`, error);
    await recordFailedResearch(db, brandId);
    return null;
  }
}

async function applyToSavedDna(db: Database, brandId: string, findings: ResearchFindings): Promise<void> {
  for (let attempt = 0; attempt < APPLY_ATTEMPTS; attempt += 1) {
    const saved = await getBrandDna(db, brandId);
    if (!saved) return;
    if (await saveBrandDnaIfVersion(db, brandId, applyResearch(saved.dna, findings), saved.version)) return;
  }
  console.warn(`Skipped applying research to brand ${brandId}: the DNA kept changing`);
}

export function createBrandResearchJob(deps: WorkerDependencies) {
  const { db } = deps;
  return defineJob(
    'brand.research',
    async ({ brandId, refresh }, context) => {
      await context.reportProgress('Researching your market');
      const brand = await findBrand(db, brandId);
      if (!brand?.url) throw new Error(`Brand ${brandId} has no URL to research`);

      const findings = await research(deps, brandId, brand.url, context);
      if (refresh) {
        if (findings) await applyToSavedDna(db, brandId, findings);
        return;
      }
      await context.enqueue(
        'brand.synthesize-dna',
        { brandId },
        { idempotencyKey: `synthesize-dna:${context.runId}` },
      );
    },
    { onFailed: ({ brandId, refresh }) => (refresh ? Promise.resolve() : fallBackToManualInput(db, brandId)) },
  );
}
