import type { Usage } from '@openlumo/providers';
import type { JobName } from './job-names';
import type { JobPayload } from './job-payloads';

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
  onFailed?(payload: JobPayload<N>, error: { code: string; message: string }): Promise<void>;
};

export function defineJob<N extends JobName>(
  name: N,
  run: (payload: JobPayload<N>, context: JobContext) => Promise<void>,
  options: { onFailed?: JobDefinition<N>['onFailed'] } = {},
): JobDefinition<N> {
  return { name, run, ...options };
}
