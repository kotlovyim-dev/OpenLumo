import { and, eq, inArray } from 'drizzle-orm';
import {
  BrandNotReadyError,
  buildExportBundle,
  defineJob,
  getBrandDna,
  transitionItem,
  type ExportableItem,
  type FormatCopy,
} from '@openlumo/core';
import { assets, contentItems, itemVersions, jobRuns, type Database } from '@openlumo/db';
import type { WorkerDependencies } from '../worker-dependencies';

class NothingToExportError extends Error {
  readonly retryable = false;
  readonly code = 'nothing_to_export';

  constructor() {
    super('None of the selected items are approved or scheduled');
    this.name = 'NothingToExportError';
  }
}

async function loadExportableItems(
  db: Database,
  brandId: string,
  itemIds: string[],
  dna: ExportableItem['dna'],
): Promise<(ExportableItem & { status: 'approved' | 'scheduled' })[]> {
  const rows = await db
    .select({ item: contentItems, version: itemVersions })
    .from(contentItems)
    .innerJoin(itemVersions, eq(itemVersions.id, contentItems.currentVersionId))
    .where(
      and(
        eq(contentItems.brandId, brandId),
        inArray(contentItems.id, itemIds),
        inArray(contentItems.status, ['approved', 'scheduled']),
      ),
    );
  const exportable = [];
  for (const { item, version } of rows) {
    const imageRows = version.assetIds.length
      ? await db.select().from(assets).where(inArray(assets.id, version.assetIds))
      : [];
    const keyById = new Map(imageRows.map((asset) => [asset.id, asset.storageKey]));
    exportable.push({
      id: item.id,
      channel: item.channel,
      format: item.format,
      scheduledAt: item.scheduledAt,
      copy: version.copy as FormatCopy,
      dna,
      imageKeys: version.assetIds.flatMap((id) => keyById.get(id) ?? []),
      status: item.status as 'approved' | 'scheduled',
    });
  }
  return exportable;
}

export function createExportBundleJob({ db, storage }: WorkerDependencies) {
  return defineJob('export.bundle', async ({ brandId, itemIds }, context) => {
    const saved = await getBrandDna(db, brandId);
    if (!saved) throw new BrandNotReadyError(brandId);
    const items = await loadExportableItems(db, brandId, itemIds, saved.dna);
    if (items.length === 0) throw new NothingToExportError();

    await context.reportProgress('Packing export');
    const bytes = await buildExportBundle(items, storage);
    const assetId = crypto.randomUUID();
    const storageKey = `brands/${brandId}/exports/${assetId}.zip`;
    await storage.write(storageKey, bytes);

    await db.transaction(async (tx) => {
      await tx.insert(assets).values({
        id: assetId,
        brandId,
        kind: 'export',
        storageKey,
        mimeType: 'application/zip',
      });
      for (const item of items) {
        await tx
          .update(contentItems)
          .set({ status: transitionItem(item.status, 'export', item.scheduledAt !== null) })
          .where(and(eq(contentItems.id, item.id), eq(contentItems.status, item.status)));
      }
      await tx.update(jobRuns).set({ resultAssetId: assetId }).where(eq(jobRuns.id, context.runId));
    });
  });
}
