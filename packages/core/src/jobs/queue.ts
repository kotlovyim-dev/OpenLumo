import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { PgBoss, type ConstructorOptions } from 'pg-boss';
import { jobRuns, type Database } from '@openlumo/db';
import { jobNames, type JobName } from './job-names';
import type { JobPayload } from './job-payloads';

export type Queue = Awaited<ReturnType<typeof createQueue>>;

export type QueueOptions = ConstructorOptions & { createQueues?: boolean };

export async function createQueue(databaseUrl: string, options: QueueOptions = {}): Promise<PgBoss> {
  const { createQueues = false, ...bossOptions } = options;
  const boss = new PgBoss({ connectionString: databaseUrl, ...bossOptions });
  await boss.start();
  if (createQueues) {
    for (const name of jobNames) {
      await boss.createQueue(name, { retryLimit: 2, retryBackoff: true, retryDelay: 5 });
    }
  }
  return boss;
}

export async function enqueue<N extends JobName>(
  boss: PgBoss,
  db: Database,
  name: N,
  payload: JobPayload<N>,
  options: { idempotencyKey?: string } = {},
): Promise<string> {
  if (options.idempotencyKey) {
    await db
      .update(jobRuns)
      .set({ idempotencyKey: null })
      .where(and(eq(jobRuns.idempotencyKey, options.idempotencyKey), eq(jobRuns.status, 'failed')));
  }
  const runId = randomUUID();
  const itemId = 'itemId' in payload ? payload.itemId : undefined;
  const inserted = await db
    .insert(jobRuns)
    .values({
      id: runId,
      jobId: runId,
      brandId: payload.brandId,
      itemId,
      type: name,
      idempotencyKey: options.idempotencyKey,
    })
    .onConflictDoNothing()
    .returning({ id: jobRuns.id });
  if (inserted.length === 0 && options.idempotencyKey) {
    const [existing] = await db
      .select({ id: jobRuns.id })
      .from(jobRuns)
      .where(eq(jobRuns.idempotencyKey, options.idempotencyKey));
    if (existing) return existing.id;
  }
  try {
    const jobId = await boss.send(name, payload, { id: runId, group: { id: payload.brandId } });
    if (!jobId) throw new Error(`pg-boss did not create a job for ${name}`);
  } catch (error) {
    await db.delete(jobRuns).where(eq(jobRuns.id, runId));
    throw error;
  }
  return runId;
}
