import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Config,
  type JobContext,
  type Queue,
  createAssetStorage,
  createBrand,
  createPartialBrandDna,
  createQueue,
  getItemWithCurrentVersion,
  InvalidTransitionError,
  loadConfig,
  requestRegeneration,
  saveBrandDna,
} from '@openlumo/core';
import { contentItems, dnaFeedback, itemVersions, jobRuns, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createItemGenerateJob } from '../src/jobs/item-generate';
import { createItemRegenerateJob } from '../src/jobs/item-regenerate';

describe('item.regenerate', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let storageDirectory: string;
  let config: Config;
  let boss: Queue;
  const progress: string[] = [];

  const context: JobContext = {
    runId: 'run',
    signal: new AbortController().signal,
    reportProgress: async (step) => {
      progress.push(step);
    },
    recordUsage: async () => {},
    enqueue: async () => 'queued',
  };

  beforeAll(async () => {
    let url: string;
    ({ db, drop, url } = await createTestDatabase());
    storageDirectory = await mkdtemp(path.join(tmpdir(), 'openlumo-regen-'));
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

  const deps = () => ({ db, config, storage: createAssetStorage(storageDirectory), boss });

  async function generatedItem(format: 'social_post' | 'email' = 'social_post') {
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    await saveBrandDna(db, brand.id, createPartialBrandDna({ name: 'Acme', palette: [] }));
    const [item] = await db
      .insert(contentItems)
      .values({ brandId: brand.id, channel: format === 'email' ? 'email' : 'instagram', format, pillar: 'p', angle: 'a' })
      .returning();
    await createItemGenerateJob(deps()).run({ brandId: brand.id, itemId: item!.id, targetVersion: 1 }, context);
    return { brand, item: item! };
  }

  async function runPayloadOf(runId: string) {
    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, runId));
    return run!;
  }

  it('collapses two back-to-back requests into one run and one new version', async () => {
    const { brand, item } = await generatedItem();
    const input = { itemId: item.id, scope: 'all' as const, feedback: 'show the crust', userId: 'u1' };

    const [first, second] = await Promise.all([requestRegeneration(db, boss, input), requestRegeneration(db, boss, input)]);
    const third = await requestRegeneration(db, boss, input);

    expect(second.runId).toBe(first.runId);
    expect(third.runId).toBe(first.runId);
    const runs = await db.select().from(jobRuns).where(eq(jobRuns.itemId, item.id));
    expect(runs.filter((run) => run.type === 'item.regenerate')).toHaveLength(1);
    expect((await runPayloadOf(first.runId)).idempotencyKey).toBe(`regenerate:${item.id}:2`);
    expect(await db.select().from(dnaFeedback).where(eq(dnaFeedback.itemId, item.id))).toHaveLength(1);

    const payload = { brandId: brand.id, itemId: item.id, targetVersion: 2, scope: 'all' as const, feedback: 'show the crust' };
    await createItemRegenerateJob(deps()).run(payload, context);
    await createItemRegenerateJob(deps()).run(payload, context);

    expect(await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id))).toHaveLength(2);
    const found = await getItemWithCurrentVersion(db, item.id);
    expect(found?.item.status).toBe('in_review');
    expect(found?.version).toMatchObject({ number: 2, author: 'user', feedback: 'show the crust' });
  });

  it('puts the feedback into the copy prompt', async () => {
    const { brand, item } = await generatedItem();

    await createItemRegenerateJob(deps()).run(
      { brandId: brand.id, itemId: item.id, targetVersion: 2, scope: 'copy', feedback: 'mention the crust' },
      context,
    );

    const found = await getItemWithCurrentVersion(db, item.id);
    expect(found?.version?.copy).toMatchObject({ imageBrief: { prompt: expect.stringContaining('mention the crust') } });
    expect(found?.version?.assetIds).toHaveLength(1);
  });

  it('keeps the copy verbatim and re-renders images for scope image', async () => {
    const { brand, item } = await generatedItem();
    const before = await getItemWithCurrentVersion(db, item.id);
    progress.length = 0;

    await createItemRegenerateJob(deps()).run(
      { brandId: brand.id, itemId: item.id, targetVersion: 2, scope: 'image' },
      context,
    );

    const after = await getItemWithCurrentVersion(db, item.id);
    expect(after?.version?.number).toBe(2);
    expect(after?.version?.copy).toEqual(before?.version?.copy);
    expect(after?.version?.assetIds).toHaveLength(1);
    expect(after?.version?.assetIds).not.toEqual(before?.version?.assetIds);
    expect(progress).toEqual(['Rendering image']);
  });

  it('refuses a rejected item without enqueuing anything', async () => {
    const { item } = await generatedItem('email');
    await db.update(contentItems).set({ status: 'rejected' }).where(eq(contentItems.id, item.id));

    await expect(requestRegeneration(db, boss, { itemId: item.id, scope: 'copy', userId: 'u1' })).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    expect(
      await db
        .select()
        .from(jobRuns)
        .where(and(eq(jobRuns.itemId, item.id), eq(jobRuns.type, 'item.regenerate'))),
    ).toHaveLength(0);
  });
});
