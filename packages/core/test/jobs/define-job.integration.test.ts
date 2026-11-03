import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { brands, jobRuns, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { ProviderError } from '@openlumo/providers';
import { defineJob, startWorker } from '../../src/jobs/define-job';
import { listenToJobEvents, type JobEvent } from '../../src/jobs/job-events';
import { createQueue, enqueue } from '../../src/jobs/queue';

const config = { globalJobConcurrency: 4, brandJobConcurrency: 2 };

async function waitForRun(db: Database, runId: string, status: 'succeeded' | 'failed') {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, runId));
    if (run?.status === status) return run;
    if (Date.now() > deadline) throw new Error(`run ${runId} stuck in ${run?.status}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('job runtime', { timeout: 30_000 }, () => {
  let db: Database;
  let url: string;
  let drop: () => Promise<void>;
  let boss: PgBoss;
  let brandId: string;

  beforeAll(async () => {
    ({ db, url, drop } = await createTestDatabase());
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
    const [brand] = await db.insert(brands).values({ name: 'B', createdBy: 'u1' }).returning({ id: brands.id });
    brandId = brand!.id;
    boss = await createQueue(url, { createQueues: true });
    await boss.updateQueue('plan.month', { retryDelay: 1, retryBackoff: false });
    await boss.updateQueue('plan.top-up', { retryDelay: 1, retryBackoff: false });
  });

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await drop();
  });

  it('marks a run succeeded and emits running then succeeded events', async () => {
    const events: JobEvent[] = [];
    const unlisten = await listenToJobEvents(url, (event) => events.push(event));
    await startWorker(boss, db, [defineJob('brand.crawl', async () => {})], config);

    const runId = await enqueue(boss, db, 'brand.crawl', { brandId });
    const run = await waitForRun(db, runId, 'succeeded');
    await expect.poll(() => events.map((event) => event.status)).toEqual(['running', 'succeeded']);
    await unlisten();

    expect(run.type).toBe('brand.crawl');
    expect(events[0]).toMatchObject({ runId, brandId, type: 'brand.crawl' });
  });

  it('fails fast on a non-retryable provider error', async () => {
    let attempts = 0;
    await startWorker(
      boss,
      db,
      [
        defineJob('strategy.create', async () => {
          attempts += 1;
          throw new ProviderError('unauthorized');
        }),
      ],
      config,
    );

    const runId = await enqueue(boss, db, 'strategy.create', { brandId });
    const run = await waitForRun(db, runId, 'failed');

    expect(run.errorCode).toBe('unauthorized');
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(attempts).toBe(1);
  });

  it('retries a rate_limited error and succeeds on the second attempt', async () => {
    let attempts = 0;
    await startWorker(
      boss,
      db,
      [
        defineJob('plan.month', async () => {
          attempts += 1;
          if (attempts === 1) throw new ProviderError('rate_limited');
        }),
      ],
      config,
    );

    const runId = await enqueue(boss, db, 'plan.month', { brandId });
    const run = await waitForRun(db, runId, 'succeeded');

    expect(attempts).toBe(2);
    expect(run.errorCode).toBeNull();
  });

  it('fails after three attempts when the error stays retryable', async () => {
    let attempts = 0;
    await startWorker(
      boss,
      db,
      [
        defineJob('plan.top-up', async () => {
          attempts += 1;
          throw new ProviderError('rate_limited');
        }),
      ],
      config,
    );

    const runId = await enqueue(boss, db, 'plan.top-up', { brandId });
    const run = await waitForRun(db, runId, 'failed');

    expect(attempts).toBe(3);
    expect(run.errorCode).toBe('rate_limited');
  });

  it('accumulates recorded usage into cost_usd', async () => {
    await startWorker(
      boss,
      db,
      [
        defineJob('chat.reply', async (_payload, context) => {
          await context.recordUsage({ inputTokens: 1, outputTokens: 1, costUsd: 0.25 });
          await context.recordUsage({ inputTokens: 1, outputTokens: 1, costUsd: 0.5 });
        }),
      ],
      config,
    );

    const runId = await enqueue(boss, db, 'chat.reply', { brandId });
    const run = await waitForRun(db, runId, 'succeeded');

    expect(run.costUsd).toBeCloseTo(0.75, 6);
  });

  it('fails a run with an invalid payload without retrying', async () => {
    await startWorker(boss, db, [defineJob('export.bundle', async () => {})], config);

    const runId = randomUUID();
    await db.insert(jobRuns).values({ id: runId, jobId: runId, brandId, type: 'export.bundle' });
    await boss.send('export.bundle', { brandId: 'not-a-uuid' }, { id: runId });
    const run = await waitForRun(db, runId, 'failed');

    expect(run.errorCode).toBe('invalid_payload');
  });

  it('returns the existing run id for a repeated idempotency key', async () => {
    const first = await enqueue(boss, db, 'brand.synthesize-dna', { brandId }, { idempotencyKey: 'dna-1' });
    const second = await enqueue(boss, db, 'brand.synthesize-dna', { brandId }, { idempotencyKey: 'dna-1' });

    expect(second).toBe(first);
    const rows = await db.select().from(jobRuns).where(eq(jobRuns.idempotencyKey, 'dna-1'));
    expect(rows).toHaveLength(1);
  });
});
