import { and, eq } from 'drizzle-orm';
import { contentItems, dnaFeedback, itemVersions, type Database } from '@openlumo/db';
import { enqueue, type Queue } from '../jobs/queue';
import { ItemNotFoundError } from './item-repository';
import { transitionItem } from './item-status';

export type RegenerationScope = 'copy' | 'image' | 'all';

export type RegenerationRequest = {
  itemId: string;
  scope: RegenerationScope;
  feedback?: string;
  userId: string;
};

export async function requestRegeneration(
  db: Database,
  boss: Queue,
  { itemId, scope, feedback }: RegenerationRequest,
): Promise<{ runId: string }> {
  const { brandId, targetVersion } = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(contentItems).where(eq(contentItems.id, itemId)).for('update');
    if (!item) throw new ItemNotFoundError(itemId);

    const status = transitionItem(item.status, 'regenerate', item.scheduledAt !== null);
    if (status !== item.status) await tx.update(contentItems).set({ status }).where(eq(contentItems.id, itemId));

    const [current] = item.currentVersionId
      ? await tx.select({ number: itemVersions.number }).from(itemVersions).where(eq(itemVersions.id, item.currentVersionId))
      : [];

    if (feedback) {
      const [duplicate] = await tx
        .select({ id: dnaFeedback.id })
        .from(dnaFeedback)
        .where(
          and(eq(dnaFeedback.itemId, itemId), eq(dnaFeedback.note, feedback), eq(dnaFeedback.merged, false)),
        );
      if (!duplicate) await tx.insert(dnaFeedback).values({ brandId: item.brandId, itemId, note: feedback });
    }
    return { brandId: item.brandId, targetVersion: (current?.number ?? 0) + 1 };
  });

  const runId = await enqueue(
    boss,
    db,
    'item.regenerate',
    { brandId, itemId, targetVersion, scope, feedback },
    { idempotencyKey: `regenerate:${itemId}:${targetVersion}` },
  );
  return { runId };
}
