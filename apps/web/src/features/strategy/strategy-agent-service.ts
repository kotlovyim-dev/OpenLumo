import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import { contentItems, jobRuns, type Database } from '@openlumo/db';
import { DRAFT_STEP, PLAN_STEP, strategyStepIndex, type AgentSnapshot } from './strategy-agent-steps';

const working = ['queued', 'running'];

async function latestStrategyRun(db: Database, brandId: string) {
  const [run] = await db
    .select({ status: jobRuns.status, step: jobRuns.step, createdAt: jobRuns.createdAt })
    .from(jobRuns)
    .where(and(eq(jobRuns.brandId, brandId), eq(jobRuns.type, 'strategy.create')))
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);
  return run;
}

async function pendingDrafts(db: Database, strategyId: string, plannedBy: Date) {
  const items = await db
    .select({ id: contentItems.id, currentVersionId: contentItems.currentVersionId })
    .from(contentItems)
    .where(and(eq(contentItems.strategyId, strategyId), lte(contentItems.createdAt, plannedBy)));
  const undrafted = items.filter((item) => !item.currentVersionId).map((item) => item.id);
  if (undrafted.length === 0) return { planned: items.length, pendingItemIds: [] };

  const runs = await db
    .selectDistinctOn([jobRuns.itemId], { itemId: jobRuns.itemId, status: jobRuns.status })
    .from(jobRuns)
    .where(and(eq(jobRuns.type, 'item.generate'), inArray(jobRuns.itemId, undrafted)))
    .orderBy(jobRuns.itemId, desc(jobRuns.createdAt));
  const pendingItemIds = runs.filter((run) => working.includes(run.status)).map((run) => run.itemId!);
  return { planned: items.length, pendingItemIds };
}

export async function loadStrategyAgent(
  db: Database,
  brandId: string,
  strategy: { id: string; createdAt: Date } | undefined,
): Promise<AgentSnapshot | null> {
  const strategyRun = await latestStrategyRun(db, brandId);
  const startedAt = (strategyRun?.createdAt ?? strategy?.createdAt ?? new Date()).toISOString();

  if (!strategy) {
    if (!strategyRun || !working.includes(strategyRun.status)) return null;
    return { step: strategyStepIndex(strategyRun.step), startedAt, planRunId: null, planned: null, pendingItemIds: [] };
  }

  const [planRun] = await db
    .select({ id: jobRuns.id, status: jobRuns.status, updatedAt: jobRuns.updatedAt })
    .from(jobRuns)
    .where(eq(jobRuns.idempotencyKey, `plan-month:${strategy.id}`));
  if (!planRun || planRun.status === 'failed') return null;
  if (working.includes(planRun.status)) {
    return { step: PLAN_STEP, startedAt, planRunId: planRun.id, planned: null, pendingItemIds: [] };
  }

  const { planned, pendingItemIds } = await pendingDrafts(db, strategy.id, planRun.updatedAt);
  if (pendingItemIds.length === 0) return null;
  return { step: DRAFT_STEP, startedAt, planRunId: planRun.id, planned, pendingItemIds };
}
