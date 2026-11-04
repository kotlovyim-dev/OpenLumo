import { and, eq, sql } from 'drizzle-orm';
import { contentItems, type Database, itemVersions, type Transaction } from '@openlumo/db';
import type { FormatCopy } from '../studio/format-schemas';

export type ContentItem = typeof contentItems.$inferSelect;
export type ItemVersion = typeof itemVersions.$inferSelect;
export type NewVersion = { copy: FormatCopy; author: ItemVersion['author']; feedback?: string };

export class ItemNotFoundError extends Error {
  readonly retryable = false;
  readonly code = 'item_not_found';

  constructor(itemId: string) {
    super(`Item ${itemId} not found`);
    this.name = 'ItemNotFoundError';
  }
}

export async function getVersion(db: Database | Transaction, itemId: string, number: number): Promise<ItemVersion | null> {
  const [row] = await db
    .select()
    .from(itemVersions)
    .where(and(eq(itemVersions.itemId, itemId), eq(itemVersions.number, number)));
  return row ?? null;
}

export async function appendVersion(
  db: Database | Transaction,
  itemId: string,
  targetVersion: number,
  version: NewVersion,
): Promise<ItemVersion | null> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(itemVersions)
      .values({ itemId, number: targetVersion, ...version })
      .onConflictDoNothing({ target: [itemVersions.itemId, itemVersions.number] })
      .returning();
    if (!inserted) return null;
    await tx
      .update(contentItems)
      .set({ currentVersionId: inserted.id })
      .where(
        and(
          eq(contentItems.id, itemId),
          sql`(${contentItems.currentVersionId} is null or ${inserted.number} > (select number from item_versions where id = ${contentItems.currentVersionId}))`,
        ),
      );
    return inserted;
  });
}

export async function getItemWithCurrentVersion(
  db: Database,
  itemId: string,
): Promise<{ item: ContentItem; version: ItemVersion | null } | null> {
  const [row] = await db
    .select({ item: contentItems, version: itemVersions })
    .from(contentItems)
    .leftJoin(itemVersions, eq(itemVersions.id, contentItems.currentVersionId))
    .where(eq(contentItems.id, itemId));
  return row ?? null;
}

export async function attachAssets(db: Database | Transaction, versionId: string, assetIds: string[]): Promise<void> {
  await db.update(itemVersions).set({ assetIds }).where(eq(itemVersions.id, versionId));
}
