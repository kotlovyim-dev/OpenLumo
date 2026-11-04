import { and, eq, inArray } from 'drizzle-orm';
import { assets, contentItems, itemVersions, jobRuns, type Database } from '@openlumo/db';
import type { FormatCopy } from '../studio/format-schemas';
import { transitionItem } from '../workspace/item-status';
import type { ExportableItem } from './build-export-bundle';

export type ExportCandidate = ExportableItem & { status: 'approved' | 'scheduled' };

export async function findExportableItems(
  db: Database,
  brandId: string,
  itemIds: string[],
  dna: ExportableItem['dna'],
): Promise<ExportCandidate[]> {
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
      ? await db
          .select()
          .from(assets)
          .where(and(eq(assets.brandId, brandId), inArray(assets.id, version.assetIds)))
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

export async function recordExport(
  db: Database,
  input: { assetId: string; brandId: string; storageKey: string; items: ExportCandidate[]; runId: string },
): Promise<void> {
  const { assetId, brandId, storageKey, items, runId } = input;
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
    await tx.update(jobRuns).set({ resultAssetId: assetId }).where(eq(jobRuns.id, runId));
  });
}
