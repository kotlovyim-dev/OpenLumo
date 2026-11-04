import { DAY_MS, defineJob, findLatestPlannedAt, findLatestStrategyId } from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

const COVERED_DAYS = 14;

export function createPlanTopUpJob({ db }: WorkerDependencies) {
  return defineJob('plan.top-up', async ({ brandId }, context) => {
    const strategyId = await findLatestStrategyId(db, brandId);
    if (!strategyId) return;

    const latestPlannedAt = await findLatestPlannedAt(db, brandId);

    const now = Date.now();
    const coveredUntil = Math.max(now, latestPlannedAt?.getTime() ?? now);
    const days = Math.round((now + COVERED_DAYS * DAY_MS - coveredUntil) / DAY_MS);
    if (days <= 0) return;

    await context.enqueue(
      'plan.month',
      { brandId, strategyId, from: new Date(coveredUntil).toISOString(), days },
      { idempotencyKey: `plan-top-up:${context.runId}` },
    );
  });
}
