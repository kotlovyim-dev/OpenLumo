import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Config,
  type JobContext,
  type Queue,
  BrandNotReadyError,
  appendVersion,
  ItemNotFoundError,
  createAssetStorage,
  createBrand,
  createPartialBrandDna,
  createQueue,
  getItemWithCurrentVersion,
  loadConfig,
  saveBrandDna,
} from '@openlumo/core';
import { ProviderError } from '@openlumo/providers';
import { assets, contentItems, dnaFeedback, itemVersions, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createItemGenerateJob } from '../src/jobs/item-generate';

describe('item.generate', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let storageDirectory: string;
  let config: Config;
  let boss: Queue;
  const progress: string[] = [];
  let usageRecords = 0;

  const context: JobContext = {
    runId: 'run',
    signal: new AbortController().signal,
    reportProgress: async (step) => {
      progress.push(step);
    },
    recordUsage: async () => {
      usageRecords += 1;
    },
    enqueue: async () => 'queued',
  };

  beforeAll(async () => {
    let url: string;
    ({ db, drop, url } = await createTestDatabase());
    storageDirectory = await mkdtemp(path.join(tmpdir(), 'openlumo-item-'));
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

  const job = () => createItemGenerateJob({ db, config, storage: createAssetStorage(storageDirectory), boss });

  async function itemFor(options: { withDna: boolean; format?: 'social_post' | 'email' }) {
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    if (options.withDna) await saveBrandDna(db, brand.id, createPartialBrandDna({ name: 'Acme', palette: [] }));
    const [item] = await db
      .insert(contentItems)
      .values({
        brandId: brand.id,
        channel: options.format === 'email' ? 'email' : 'instagram',
        format: options.format ?? 'social_post',
        pillar: 'Behind the scenes',
        angle: 'Dawn bake',
      })
      .returning();
    return { brand, item: item! };
  }

  it('writes version 1 as planner, sets it current and reports progress', async () => {
    progress.length = 0;
    const { brand, item } = await itemFor({ withDna: true });

    await job().run({ brandId: brand.id, itemId: item.id, targetVersion: 1 }, context);

    expect(progress).toEqual(['Writing copy', 'Rendering image']);
    const found = await getItemWithCurrentVersion(db, item.id);
    expect(found?.version).toMatchObject({ number: 1, author: 'planner' });
    expect(found?.version?.copy).toMatchObject({ caption: expect.any(String), imageBrief: { prompt: expect.any(String) } });
    expect(found?.item.currentVersionId).toBe(found?.version?.id);
  });

  it('leaves exactly one version when run twice with the same targetVersion', async () => {
    const { brand, item } = await itemFor({ withDna: true, format: 'email' });
    const payload = { brandId: brand.id, itemId: item.id, targetVersion: 1 };

    await job().run(payload, context);
    await job().run(payload, context);

    expect(await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id))).toHaveLength(1);
  });

  it('adds the next version and moves current to it, passing the instruction to the model', async () => {
    const { brand, item } = await itemFor({ withDna: true });
    await db.insert(dnaFeedback).values({ brandId: brand.id, note: 'more playful' });

    await job().run({ brandId: brand.id, itemId: item.id, targetVersion: 1 }, context);
    await job().run(
      { brandId: brand.id, itemId: item.id, targetVersion: 2, instruction: 'show the crust' },
      context,
    );

    const found = await getItemWithCurrentVersion(db, item.id);
    expect(found?.version?.number).toBe(2);
    expect(found?.version?.copy).toMatchObject({ imageBrief: { prompt: expect.stringContaining('show the crust') } });
    expect(await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id))).toHaveLength(2);
  });

  it('fails with BrandNotReadyError and writes no version when the brand has no dna', async () => {
    const { brand, item } = await itemFor({ withDna: false });

    await expect(job().run({ brandId: brand.id, itemId: item.id, targetVersion: 1 }, context)).rejects.toBeInstanceOf(
      BrandNotReadyError,
    );
    expect(await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id))).toHaveLength(0);
  });

  it('makes no model request when the target version already exists', async () => {
    const { brand, item } = await itemFor({ withDna: true });
    const payload = { brandId: brand.id, itemId: item.id, targetVersion: 1 };
    await job().run(payload, context);
    const before = usageRecords;

    await job().run(payload, context);

    expect(usageRecords).toBe(before);
  });

  it('fails with a non-retryable item_not_found error for a missing item', async () => {
    const { brand } = await itemFor({ withDna: true });

    const failure = await job()
      .run({ brandId: brand.id, itemId: crypto.randomUUID(), targetVersion: 1 }, context)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ItemNotFoundError);
    expect(failure).toMatchObject({ code: 'item_not_found', retryable: false });
  });

  it('does not move current_version_id back when an older version arrives late', async () => {
    const { item } = await itemFor({ withDna: true });
    const copy = { subject: 's', preheader: '', body: 'b' };
    const second = await appendVersion(db, item.id, 2, { copy, author: 'planner' });
    await appendVersion(db, item.id, 1, { copy, author: 'planner' });

    const found = await getItemWithCurrentVersion(db, item.id);
    expect(found?.item.currentVersionId).toBe(second!.id);
    expect(await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id))).toHaveLength(2);
  });

  it('stores one image asset for a social post and attaches it to the version', async () => {
    const { brand, item } = await itemFor({ withDna: true });

    await job().run({ brandId: brand.id, itemId: item.id, targetVersion: 1 }, context);

    const found = await getItemWithCurrentVersion(db, item.id);
    const [asset] = await db.select().from(assets).where(eq(assets.brandId, brand.id));
    expect(found?.version?.assetIds).toEqual([asset?.id]);
    expect(asset).toMatchObject({
      kind: 'image',
      provider: 'fake',
      model: 'fake/image',
      mimeType: 'image/png',
      storageKey: `brands/${brand.id}/${asset?.id}.png`,
    });
    expect(asset?.width).toBeGreaterThan(0);
    expect((await createAssetStorage(storageDirectory).read(asset!.storageKey)).length).toBeGreaterThan(0);
  });

  it('renders no image for an email', async () => {
    const { brand, item } = await itemFor({ withDna: true, format: 'email' });

    await job().run({ brandId: brand.id, itemId: item.id, targetVersion: 1 }, context);

    expect(await db.select().from(assets).where(eq(assets.brandId, brand.id))).toHaveLength(0);
  });

  it('keeps the copy and reports the image step when image rendering fails, then renders on re-run', async () => {
    progress.length = 0;
    const { brand, item } = await itemFor({ withDna: true });
    const payload = { brandId: brand.id, itemId: item.id, targetVersion: 1, instruction: 'loaf #fail-once' };

    const failure = await job()
      .run(payload, context)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProviderError);
    expect(failure).toMatchObject({ code: 'invalid_output' });
    expect(progress.at(-1)).toBe('Rendering image');
    const failed = await getItemWithCurrentVersion(db, item.id);
    expect(failed?.version?.copy).toMatchObject({ caption: expect.any(String) });
    expect(failed?.version?.assetIds).toEqual([]);

    await job().run(payload, context);

    const retried = await getItemWithCurrentVersion(db, item.id);
    expect(retried?.version?.assetIds).toHaveLength(1);
    expect(await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id))).toHaveLength(1);
  });

  it('renders every carousel slide', async () => {
    const { brand, item } = await itemFor({ withDna: true });
    await db.update(contentItems).set({ format: 'carousel' }).where(eq(contentItems.id, item.id));

    await job().run({ brandId: brand.id, itemId: item.id, targetVersion: 1 }, context);

    const found = await getItemWithCurrentVersion(db, item.id);
    const slides = (found?.version?.copy as { slides: unknown[] }).slides;
    expect(found?.version?.assetIds).toHaveLength(slides.length);
  });
});
