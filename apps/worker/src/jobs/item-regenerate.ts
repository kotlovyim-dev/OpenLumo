import {
  appendVersion,
  defineJob,
  getItemWithCurrentVersion,
  getVersion,
  ItemNotFoundError,
  type FormatCopy,
  type ItemVersion,
  type JobContext,
  type JobPayload,
} from '@openlumo/core';
import { writeCopy, writeImages } from './item-steps';
import type { WorkerDependencies } from '../worker-dependencies';

async function regenerateItem(
  deps: WorkerDependencies,
  { brandId, itemId, targetVersion, scope, feedback }: JobPayload<'item.regenerate'>,
  context: JobContext,
): Promise<void> {
  const found = await getItemWithCurrentVersion(deps.db, itemId);
  if (!found) throw new ItemNotFoundError(itemId);

  const existing = await getVersion(deps.db, itemId, targetVersion);
  let version: ItemVersion | null = existing;
  if (!version && scope === 'image' && found.version) {
    version = await appendVersion(deps.db, itemId, targetVersion, {
      copy: found.version.copy as FormatCopy,
      author: 'user',
      feedback,
    });
  } else if (!version) {
    version = await writeCopy(
      deps,
      { brandId, itemId, targetVersion, instruction: feedback, author: 'user', feedback },
      found.item,
      context,
    );
  }
  if (!version) return;
  await writeImages(deps, brandId, found.item, version, context, scope === 'image' ? feedback : undefined);
}

export function createItemRegenerateJob(deps: WorkerDependencies) {
  return defineJob('item.regenerate', (payload, context) => regenerateItem(deps, payload, context));
}
