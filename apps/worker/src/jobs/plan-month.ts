import { and, eq, gte, lt, ne } from 'drizzle-orm';
import {
  BrandNotReadyError,
  defineJob,
  getBrandDna,
  planContent,
  resolveModels,
  strategyDocumentSchema,
  type PlannedSlot,
} from '@openlumo/core';
import { contentItems, strategies } from '@openlumo/db';
import type { WorkerDependencies } from '../worker-dependencies';

const DAY_MS = 86_400_000;

export function createPlanMonthJob({ db, config }: WorkerDependencies) {
  return defineJob('plan.month', async ({ brandId, strategyId, from, days }, context) => {
    await context.reportProgress('Planning your content');

    const saved = await getBrandDna(db, brandId);
    if (!saved) throw new BrandNotReadyError(brandId);
    const [strategy] = await db.select().from(strategies).where(eq(strategies.id, strategyId));
    if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

    const start = new Date(from);
    const end = new Date(start.getTime() + days * DAY_MS);
    const existing: PlannedSlot[] = (
      await db
        .select()
        .from(contentItems)
        .where(
          and(
            eq(contentItems.brandId, brandId),
            ne(contentItems.status, 'rejected'),
            gte(contentItems.scheduledAt, start),
            lt(contentItems.scheduledAt, end),
          ),
        )
    ).map((item) => ({
      channel: item.channel,
      format: item.format,
      pillar: item.pillar ?? '',
      angle: item.angle ?? '',
      scheduledAt: item.scheduledAt!,
    }));

    const { brain } = await resolveModels(db, config);
    const { slots, usage } = await planContent(brain.model, brain.modelId, {
      dna: saved.dna,
      strategy: strategyDocumentSchema.parse(strategy.document),
      from: start,
      days,
      existing,
    });
    await context.recordUsage(usage);
    if (slots.length === 0) return;

    const items = await db
      .insert(contentItems)
      .values(slots.map((slot) => ({ ...slot, brandId, strategyId, status: 'suggested' as const })))
      .returning({ id: contentItems.id });
    for (const { id: itemId } of items) {
      await context.enqueue(
        'item.generate',
        { brandId, itemId, targetVersion: 1 },
        { idempotencyKey: `generate:${itemId}:1` },
      );
    }
  });
}
