import {
  BrandNotReadyError,
  brandStorageKey,
  buildExportBundle,
  defineJob,
  findExportableItems,
  getBrandDna,
  recordExport,
} from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

class NothingToExportError extends Error {
  readonly retryable = false;
  readonly code = 'nothing_to_export';

  constructor() {
    super('None of the selected items are approved or scheduled');
    this.name = 'NothingToExportError';
  }
}

export function createExportBundleJob({ db, storage }: WorkerDependencies) {
  return defineJob('export.bundle', async ({ brandId, itemIds }, context) => {
    const saved = await getBrandDna(db, brandId);
    if (!saved) throw new BrandNotReadyError(brandId);
    const items = await findExportableItems(db, brandId, itemIds, saved.dna);
    if (items.length === 0) throw new NothingToExportError();

    await context.reportProgress('Packing export');
    const bytes = await buildExportBundle(items, storage);
    const assetId = crypto.randomUUID();
    const storageKey = brandStorageKey(brandId, 'exports', `${assetId}.zip`);
    await storage.write(storageKey, bytes);

    await recordExport(db, { assetId, brandId, storageKey, items, runId: context.runId });
  });
}
