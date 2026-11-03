import { eq, sql } from 'drizzle-orm';
import { jobRuns, type Database } from '@openlumo/db';
import type { Usage } from '@openlumo/providers';
import { publishJobEvent, type JobEvent } from './job-events';
import type { JobName } from './job-names';

export async function updateRun(
  db: Database,
  runId: string,
  changes: Partial<typeof jobRuns.$inferInsert>,
): Promise<void> {
  const [run] = await db
    .update(jobRuns)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(jobRuns.id, runId))
    .returning();
  if (!run) return;
  const event: JobEvent = {
    runId: run.id,
    brandId: run.brandId,
    itemId: run.itemId ?? undefined,
    type: run.type as JobName,
    status: run.status,
    step: run.step ?? undefined,
    errorCode: run.errorCode ?? undefined,
  };
  await publishJobEvent(db, event);
}

export async function addRunCost(db: Database, runId: string, usage: Usage): Promise<void> {
  await db
    .update(jobRuns)
    .set({ costUsd: sql`${jobRuns.costUsd} + ${usage.costUsd}` })
    .where(eq(jobRuns.id, runId));
}
