import {
  defineJob,
  getItemWithCurrentVersion,
  getVersion,
  ItemNotFoundError,
  type JobContext,
  type JobPayload,
} from '@openlumo/core';
import { writeCopy, writeImages } from './item-steps';
import type { WorkerDependencies } from '../worker-dependencies';

async function generateItem(
  deps: WorkerDependencies,
  payload: JobPayload<'item.generate'>,
  context: JobContext,
): Promise<void> {
  const { db } = deps;
  const { itemId, targetVersion } = payload;
  const found = await getItemWithCurrentVersion(db, itemId);
  if (!found) throw new ItemNotFoundError(itemId);

  const existing = await getVersion(db, itemId, targetVersion);
  const version = existing ?? (await writeCopy(deps, { ...payload, author: 'planner' }, found.item, context));
  if (!version) return;
  await writeImages(deps, payload.brandId, found.item, version, context);
}

export function createItemGenerateJob(deps: WorkerDependencies) {
  return defineJob('item.generate', (payload, context) => generateItem(deps, payload, context));
}
