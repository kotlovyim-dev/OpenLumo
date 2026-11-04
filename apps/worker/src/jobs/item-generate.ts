import {
  appendVersion,
  BrandNotReadyError,
  copyLanguage,
  defineJob,
  generateCopy,
  getBrandDna,
  getItemWithCurrentVersion,
  hasVersion,
  ItemNotFoundError,
  listOpenFeedback,
  resolveModels,
  type JobContext,
  type JobPayload,
} from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

async function writeCopy(
  { db, config }: WorkerDependencies,
  { brandId, itemId, targetVersion, instruction }: JobPayload<'item.generate'>,
  context: JobContext,
): Promise<void> {
  await context.reportProgress('Writing copy');

  const found = await getItemWithCurrentVersion(db, itemId);
  if (!found) throw new ItemNotFoundError(itemId);
  if (await hasVersion(db, itemId, targetVersion)) return;
  const { item } = found;
  const saved = await getBrandDna(db, brandId);
  if (!saved) throw new BrandNotReadyError(brandId);

  const { brain } = await resolveModels(db, config);
  const { copy, usage } = await generateCopy(brain.model, brain.modelId, {
    dna: saved.dna,
    feedback: await listOpenFeedback(db, brandId),
    item: { channel: item.channel, format: item.format, pillar: item.pillar ?? '', angle: item.angle ?? '' },
    instruction,
    language: copyLanguage(saved.dna),
  });
  await context.recordUsage(usage);
  await appendVersion(db, itemId, targetVersion, { copy, author: 'planner' });
}

export function createItemGenerateJob(deps: WorkerDependencies) {
  return defineJob('item.generate', (payload, context) => writeCopy(deps, payload, context));
}
