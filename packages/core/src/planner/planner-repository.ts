import { and, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { contentItems, strategies, type Database } from '@openlumo/db';
import type { PlannedSlot } from './plan-schema';

export type Strategy = typeof strategies.$inferSelect;
export type WindowItem = { id: string; status: string; currentVersionId: string | null };

export async function insertStrategy(
  db: Database,
  values: Pick<typeof strategies.$inferInsert, 'brandId' | 'goal' | 'channels' | 'document'>,
): Promise<Strategy> {
  const [strategy] = await db.insert(strategies).values(values).returning();
  return strategy!;
}

export async function findStrategy(db: Database, strategyId: string): Promise<Strategy | undefined> {
  const [strategy] = await db.select().from(strategies).where(eq(strategies.id, strategyId));
  return strategy;
}

export async function findLatestStrategyId(db: Database, brandId: string): Promise<string | undefined> {
  const [strategy] = await db
    .select({ id: strategies.id })
    .from(strategies)
    .where(eq(strategies.brandId, brandId))
    .orderBy(desc(strategies.createdAt))
    .limit(1);
  return strategy?.id;
}

export async function listStrategyItemsInWindow(
  db: Database,
  strategyId: string,
  start: Date,
  end: Date,
): Promise<WindowItem[]> {
  return db
    .select({ id: contentItems.id, status: contentItems.status, currentVersionId: contentItems.currentVersionId })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.strategyId, strategyId),
        gte(contentItems.scheduledAt, start),
        lt(contentItems.scheduledAt, end),
      ),
    );
}

export async function listBrandSlotsInWindow(
  db: Database,
  brandId: string,
  start: Date,
  end: Date,
): Promise<PlannedSlot[]> {
  const rows = await db
    .select()
    .from(contentItems)
    .where(
      and(
        eq(contentItems.brandId, brandId),
        ne(contentItems.status, 'rejected'),
        gte(contentItems.scheduledAt, start),
        lt(contentItems.scheduledAt, end),
      ),
    );
  return rows.map((item) => ({
    channel: item.channel,
    format: item.format,
    pillar: item.pillar ?? '',
    angle: item.angle ?? '',
    scheduledAt: item.scheduledAt!,
  }));
}

export async function insertSuggestedItems(
  db: Database,
  brandId: string,
  strategyId: string,
  slots: PlannedSlot[],
): Promise<string[]> {
  const rows = await db
    .insert(contentItems)
    .values(slots.map((slot) => ({ ...slot, brandId, strategyId, status: 'suggested' as const })))
    .returning({ id: contentItems.id });
  return rows.map((row) => row.id);
}

export async function findLatestPlannedAt(db: Database, brandId: string): Promise<Date | null> {
  const [latest] = await db
    .select({ scheduledAt: contentItems.scheduledAt })
    .from(contentItems)
    .where(and(eq(contentItems.brandId, brandId), inArray(contentItems.status, ['suggested', 'approved'])))
    .orderBy(desc(contentItems.scheduledAt))
    .limit(1);
  return latest?.scheduledAt ?? null;
}
