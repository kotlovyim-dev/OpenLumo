import { eq, sql } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { jobRuns, type Database } from '@openlumo/db';
import type { Usage } from '@openlumo/providers';
import type { Config } from '../config';
import { publishJobEvent, type JobEvent } from './job-events';
import type { JobName } from './job-names';
import { jobPayloads, type JobPayload } from './job-payloads';
import { enqueue } from './queue';

export type JobContext = {
  runId: string;
  signal: AbortSignal;
  reportProgress(step: string): Promise<void>;
  recordUsage(usage: Usage): Promise<void>;
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: { idempotencyKey?: string },
  ): Promise<string>;
};

export type JobDefinition<N extends JobName = JobName> = {
  name: N;
  run(payload: JobPayload<N>, context: JobContext): Promise<void>;
};

export function defineJob<N extends JobName>(
  name: N,
  run: (payload: JobPayload<N>, context: JobContext) => Promise<void>,
): JobDefinition<N> {
  return { name, run };
}

type WorkerConfig = Pick<Config, 'globalJobConcurrency' | 'brandJobConcurrency'>;

function describeError(error: unknown): { code: string; message: string; retryable: boolean } {
  const { code, retryable, message } = (error ?? {}) as Record<string, unknown>;
  return {
    code: typeof code === 'string' ? code : 'unknown',
    message: typeof message === 'string' ? message : String(error),
    retryable: retryable !== false,
  };
}

async function updateRun(
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

export async function startWorker(
  boss: PgBoss,
  db: Database,
  definitions: JobDefinition[],
  config: WorkerConfig,
): Promise<void> {
  for (const definition of definitions) {
    await boss.work(
      definition.name,
      {
        localConcurrency: config.globalJobConcurrency,
        localGroupConcurrency: Math.min(config.brandJobConcurrency, config.globalJobConcurrency),
        includeMetadata: true,
      },
      async ([job]) => {
        if (!job) return;
        const runId = job.id;
        await updateRun(db, runId, { status: 'running', step: null, error: null, errorCode: null });

        const parsed = jobPayloads[definition.name].safeParse(job.data);
        if (!parsed.success) {
          await updateRun(db, runId, {
            status: 'failed',
            errorCode: 'invalid_payload',
            error: parsed.error.message,
          });
          return;
        }

        const context: JobContext = {
          runId,
          signal: job.signal,
          reportProgress: (step) => updateRun(db, runId, { step }),
          recordUsage: async (usage) => {
            await db
              .update(jobRuns)
              .set({ costUsd: sql`${jobRuns.costUsd} + ${usage.costUsd}` })
              .where(eq(jobRuns.id, runId));
          },
          enqueue: (name, payload, options) => enqueue(boss, db, name, payload, options),
        };

        try {
          await definition.run(parsed.data, context);
        } catch (error) {
          const { code, message, retryable } = describeError(error);
          const finalAttempt = job.retryCount >= job.retryLimit;
          if (!retryable || finalAttempt) {
            await updateRun(db, runId, { status: 'failed', errorCode: code, error: message });
            return;
          }
          await updateRun(db, runId, { status: 'queued', errorCode: code, error: message });
          throw error;
        }
        await updateRun(db, runId, { status: 'succeeded' });
      },
    );
  }
}
