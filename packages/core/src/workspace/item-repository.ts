import { eq } from 'drizzle-orm';
import { contentItems, type Database, itemVersions } from '@openlumo/db';
import type { FormatCopy } from '../studio/format-schemas';

export type ContentItem = typeof contentItems.$inferSelect;
export type ItemVersion = typeof itemVersions.$inferSelect;
export type NewVersion = { copy: FormatCopy; author: ItemVersion['author'] };

export async function appendVersion(
  db: Database,
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
    await tx.update(contentItems).set({ currentVersionId: inserted.id }).where(eq(contentItems.id, itemId));
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
