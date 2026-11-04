import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createBrand } from '@openlumo/core';
import { contentItems, itemVersions, jobRuns, strategies, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { loadStrategyAgent } from '../src/features/strategy/strategy-agent-service';
import { DRAFT_STEP, PLAN_STEP } from '../src/features/strategy/strategy-agent-steps';

type RunStatus = (typeof jobRuns.$inferSelect)['status'];

describe('loadStrategyAgent', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.db.insert(users).values({ id: 'owner', name: 'Owner', email: 'owner@example.com' });
  });

  afterAll(async () => {
    await database.drop();
  });

  const newBrand = async () => (await createBrand(database.db, { name: 'Acme', createdBy: 'owner' })).id;

  async function run(brandId: string, type: string, status: RunStatus, extra: Partial<typeof jobRuns.$inferInsert> = {}) {
    const [inserted] = await database.db.insert(jobRuns).values({ brandId, type, status, ...extra }).returning();
    return inserted!;
  }

  async function strategyFor(brandId: string) {
    const [strategy] = await database.db
      .insert(strategies)
      .values({ brandId, goal: 'awareness', channels: ['instagram'], document: {} })
      .returning();
    return strategy!;
  }

  async function item(brandId: string, strategyId: string, drafted: boolean) {
    const [created] = await database.db
      .insert(contentItems)
      .values({ brandId, strategyId, channel: 'instagram', format: 'social_post' })
      .returning();
    if (drafted) {
      const [version] = await database.db
        .insert(itemVersions)
        .values({ itemId: created!.id, number: 1, copy: {}, assetIds: [], author: 'planner' })
        .returning();
      await database.db.update(contentItems).set({ currentVersionId: version!.id }).where(eq(contentItems.id, created!.id));
    }
    return created!.id;
  }

  it('stays hidden when nothing is running', async () => {
    expect(await loadStrategyAgent(database.db, await newBrand(), undefined)).toBeNull();
  });

  it('picks up the section a running strategy job last reported', async () => {
    const brandId = await newBrand();
    await run(brandId, 'strategy.create', 'running', { step: 'pillars' });
    expect(await loadStrategyAgent(database.db, brandId, undefined)).toMatchObject({ step: 3, planRunId: null });
  });

  it('shows month planning while the first plan run works', async () => {
    const brandId = await newBrand();
    const strategy = await strategyFor(brandId);
    const planRun = await run(brandId, 'plan.month', 'running', { idempotencyKey: `plan-month:${strategy.id}` });
    expect(await loadStrategyAgent(database.db, brandId, strategy)).toMatchObject({ step: PLAN_STEP, planRunId: planRun.id });
  });

  it('counts drafts still being written for the first month only', async () => {
    const brandId = await newBrand();
    const strategy = await strategyFor(brandId);
    const done = await item(brandId, strategy.id, true);
    const writing = await item(brandId, strategy.id, false);
    const gaveUp = await item(brandId, strategy.id, false);
    await run(brandId, 'item.generate', 'succeeded', { itemId: done });
    await run(brandId, 'item.generate', 'running', { itemId: writing });
    await run(brandId, 'item.generate', 'failed', { itemId: gaveUp });
    const planRun = await run(brandId, 'plan.month', 'succeeded', { idempotencyKey: `plan-month:${strategy.id}` });
    const later = await item(brandId, strategy.id, false);
    await run(brandId, 'item.generate', 'running', { itemId: later });

    expect(await loadStrategyAgent(database.db, brandId, strategy)).toMatchObject({
      step: DRAFT_STEP,
      planRunId: planRun.id,
      planned: 3,
      pendingItemIds: [writing],
    });
  });

  it('stays hidden once every first-month draft is finished', async () => {
    const brandId = await newBrand();
    const strategy = await strategyFor(brandId);
    await item(brandId, strategy.id, true);
    await run(brandId, 'plan.month', 'succeeded', { idempotencyKey: `plan-month:${strategy.id}` });
    expect(await loadStrategyAgent(database.db, brandId, strategy)).toBeNull();
  });
});
