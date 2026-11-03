import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Config,
  type JobContext,
  type JobName,
  type JobPayload,
  createAssetStorage,
  createBrand,
  createPartialBrandDna,
  createQueue,
  type Queue,
  loadConfig,
  saveBrandDna,
} from '@openlumo/core';
import { contentItems, strategies, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createPlanMonthJob } from '../src/jobs/plan-month';
import { createPlanTopUpJob } from '../src/jobs/plan-top-up';
import { createStrategyCreateJob } from '../src/jobs/strategy-create';

const DAY_MS = 86_400_000;

type Enqueued = { name: JobName; payload: Record<string, unknown>; options?: { idempotencyKey?: string } };

describe('planner jobs', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let url: string;
  let storageDirectory: string;
  let config: Config;
  let boss: Queue;
  const enqueued: Enqueued[] = [];

  const context: JobContext = {
    runId: 'run',
    signal: new AbortController().signal,
    reportProgress: async () => {},
    recordUsage: async () => {},
    enqueue: async (name, payload, options) => {
      enqueued.push({ name, payload: payload as Record<string, unknown>, options });
      return 'queued';
    },
  };

  beforeAll(async () => {
    ({ db, drop, url } = await createTestDatabase());
    storageDirectory = await mkdtemp(path.join(tmpdir(), 'openlumo-planner-'));
    config = loadConfig({
      DATABASE_URL: 'postgres://unused',
      APP_SECRET: 'x'.repeat(32),
      PUBLIC_URL: 'http://localhost:3000',
      OPENLUMO_TEST_PROVIDERS: 'fake',
    });
    boss = await createQueue(url, { createQueues: true });
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
  });

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await rm(storageDirectory, { recursive: true, force: true });
    await drop();
  });

  function deps() {
    return { db, config, storage: createAssetStorage(storageDirectory), boss };
  }

  async function readyBrand() {
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    await saveBrandDna(db, brand.id, createPartialBrandDna({ name: 'Acme', palette: [] }));
    return brand;
  }

  async function strategyFor(brandId: string) {
    const [strategy] = await db
      .insert(strategies)
      .values({ brandId, goal: 'sales', channels: ['x'], document: {} })
      .returning();
    return strategy!;
  }

  it('strategy.create saves the strategy and schedules the weekly top-up, then plan.month plans items that start drafts', async () => {
    enqueued.length = 0;
    const brand = await readyBrand();

    await createStrategyCreateJob(deps()).run(
      { brandId: brand.id, goal: 'awareness', channels: ['instagram', 'email'] },
      context,
    );

    const [strategy] = await db.select().from(strategies).where(eq(strategies.brandId, brand.id));
    expect(strategy?.goal).toBe('awareness');
    expect(strategy?.channels).toEqual(['instagram', 'email']);
    const schedules = await boss.getSchedules('plan.top-up', brand.id);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({ cron: '0 6 * * 1', data: { brandId: brand.id } });
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      name: 'plan.month',
      payload: { brandId: brand.id, strategyId: strategy!.id, days: 30 },
    });

    const monthPayload = enqueued[0]!.payload as JobPayload<'plan.month'>;
    enqueued.length = 0;
    await createPlanMonthJob(deps()).run(monthPayload, context);

    const items = await db.select().from(contentItems).where(eq(contentItems.brandId, brand.id));
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((item) => item.status === 'suggested' && item.strategyId === strategy!.id)).toBe(true);
    const from = Date.parse(monthPayload.from);
    expect(items.every((item) => item.scheduledAt!.getTime() >= from && item.scheduledAt!.getTime() < from + 30 * DAY_MS)).toBe(true);
    expect(enqueued.map((call) => call.name)).toEqual(items.map(() => 'item.generate'));
    expect(enqueued.every((call) => call.payload.targetVersion === 1)).toBe(true);
    expect(enqueued.map((call) => call.options?.idempotencyKey).sort()).toEqual(
      items.map((item) => `generate:${item.id}:1`).sort(),
    );
  });

  it('strategy.create fails non-retryably with brand_not_ready when there is no DNA', async () => {
    const brand = await createBrand(db, { name: 'Empty', createdBy: 'u1' });
    await expect(
      createStrategyCreateJob(deps()).run({ brandId: brand.id, goal: 'leads', channels: ['blog'] }, context),
    ).rejects.toMatchObject({ code: 'brand_not_ready', retryable: false });
  });

  it('top-up with 10 days already covered plans only the remaining days', async () => {
    enqueued.length = 0;
    const brand = await readyBrand();
    const strategy = await strategyFor(brand.id);
    const coveredUntil = new Date(Date.now() + 10 * DAY_MS);
    await db.insert(contentItems).values({
      brandId: brand.id,
      strategyId: strategy.id,
      channel: 'x',
      format: 'social_post',
      status: 'approved',
      scheduledAt: coveredUntil,
    });

    await createPlanTopUpJob(deps()).run({ brandId: brand.id }, context);

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      name: 'plan.month',
      payload: { brandId: brand.id, strategyId: strategy.id, from: coveredUntil.toISOString(), days: 4 },
    });
  });

  it('top-up does nothing when 14 days are covered or no strategy exists', async () => {
    enqueued.length = 0;
    const withoutStrategy = await readyBrand();
    await createPlanTopUpJob(deps()).run({ brandId: withoutStrategy.id }, context);

    const covered = await readyBrand();
    const strategy = await strategyFor(covered.id);
    await db.insert(contentItems).values({
      brandId: covered.id,
      strategyId: strategy.id,
      channel: 'x',
      format: 'social_post',
      status: 'suggested',
      scheduledAt: new Date(Date.now() + 15 * DAY_MS),
    });
    await createPlanTopUpJob(deps()).run({ brandId: covered.id }, context);

    expect(enqueued).toEqual([]);
  });
});
