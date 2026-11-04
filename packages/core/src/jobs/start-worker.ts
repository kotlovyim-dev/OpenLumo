import type { PgBoss } from 'pg-boss';
import { jobRuns, type Database } from '@openlumo/db';
import type { Config } from '../config';
import type { JobContext, JobDefinition } from './define-job';
import { jobPayloads } from './job-payloads';
import { addRunCost, updateRun } from './job-runs';
import { enqueue } from './queue';

type WorkerConfig = Pick<Config, 'globalJobConcurrency' | 'brandJobConcurrency'>;

function describeError(error: unknown): { code: string; message: string; retryable: boolean } {
  const { code, retryable, message } = (error ?? {}) as Record<string, unknown>;
  return {
    code: typeof code === 'string' ? code : 'unknown',
    message: typeof message === 'string' ? message : String(error),
    retryable: retryable !== false,
  };
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
        batchSize: 1,
        includeMetadata: true,
      },
      async ([job]) => {
        if (!job) return;
        const runId = job.id;
        const parsed = jobPayloads[definition.name].safeParse(job.data);
        if (parsed.success) {
          await db
            .insert(jobRuns)
            .values({
              id: runId,
              jobId: runId,
              brandId: parsed.data.brandId,
              itemId: 'itemId' in parsed.data && typeof parsed.data.itemId === 'string' ? parsed.data.itemId : undefined,
              type: definition.name,
            })
            .onConflictDoNothing({ target: jobRuns.id });
        }
        await updateRun(db, runId, { status: 'running', step: null, error: null, errorCode: null });

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
          recordUsage: (usage) => addRunCost(db, runId, usage),
          enqueue: (name, payload, options) => enqueue(boss, db, name, payload, options),
        };

        try {
          await definition.run(parsed.data, context);
        } catch (error) {
          const { code, message, retryable } = describeError(error);
          const finalAttempt = job.retryCount >= job.retryLimit;
          if (!retryable || finalAttempt) {
            try {
              await definition.onFailed?.(parsed.data, { code, message });
            } catch (hookError) {
              console.error(`onFailed hook for ${definition.name} threw`, hookError);
            }
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
