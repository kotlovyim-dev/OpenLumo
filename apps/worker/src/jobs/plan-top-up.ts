import { and, desc, eq, inArray } from 'drizzle-orm';
import { defineJob } from '@openlumo/core';
import { contentItems, strategies } from '@openlumo/db';
import type { WorkerDependencies } from '../worker-dependencies';

const DAY_MS = 86_400_000;
const COVERED_DAYS = 14;

export function createPlanTopUpJob({ db }: WorkerDependencies) {
  return defineJob('plan.top-up', async ({ brandId }, context) => {
    const [strategy] = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(eq(strategies.brandId, brandId))
      .orderBy(desc(strategies.createdAt))
      .limit(1);
    if (!strategy) return;

    const [latest] = await db
      .select({ scheduledAt: contentItems.scheduledAt })
      .from(contentItems)
      .where(and(eq(contentItems.brandId, brandId), inArray(contentItems.status, ['suggested', 'approved'])))
      .orderBy(desc(contentItems.scheduledAt))
      .limit(1);

    const now = Date.now();
    const coveredUntil = Math.max(now, latest?.scheduledAt?.getTime() ?? now);
    const days = Math.round((now + COVERED_DAYS * DAY_MS - coveredUntil) / DAY_MS);
    if (days <= 0) return;

    await context.enqueue(
      'plan.month',
      { brandId, strategyId: strategy.id, from: new Date(coveredUntil).toISOString(), days },
      { idempotencyKey: `plan-top-up:${context.runId}` },
    );
  });
}
