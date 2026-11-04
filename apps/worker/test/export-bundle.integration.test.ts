import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type JobContext,
  createAssetStorage,
  createBrand,
  createPartialBrandDna,
  loadConfig,
  saveBrandDna,
} from '@openlumo/core';
import { assets, contentItems, itemVersions, jobRuns, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createExportBundleJob } from '../src/jobs/export-bundle';

describe('export.bundle', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let storageDirectory: string;
  const progress: string[] = [];
  const storageOf = () => createAssetStorage(storageDirectory);

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    storageDirectory = await mkdtemp(path.join(tmpdir(), 'openlumo-export-'));
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
  });

  afterAll(async () => {
    await rm(storageDirectory, { recursive: true, force: true });
    await drop();
  });

  async function setup() {
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    await saveBrandDna(db, brand.id, createPartialBrandDna({ name: 'Acme', palette: ['#112233'] }));
    const [run] = await db.insert(jobRuns).values({ brandId: brand.id, type: 'export.bundle' }).returning();
    const context: JobContext = {
      runId: run!.id,
      signal: new AbortController().signal,
      reportProgress: async (step) => {
        progress.push(step);
      },
      recordUsage: async () => {},
      enqueue: async () => 'queued',
    };
    const job = createExportBundleJob({
      db,
      config: loadConfig({
        DATABASE_URL: 'postgres://unused',
        APP_SECRET: 'x'.repeat(32),
        PUBLIC_URL: 'http://localhost:3000',
        OPENLUMO_TEST_PROVIDERS: 'fake',
      }),
      storage: storageOf(),
      boss: undefined as never,
    });
    return { brand, run: run!, context, job };
  }

  async function addItem(
    brandId: string,
    status: 'approved' | 'scheduled' | 'suggested',
    scheduledAt: Date | null,
    caption: string,
  ) {
    const [item] = await db
      .insert(contentItems)
      .values({ brandId, channel: 'instagram', format: 'social_post', status, scheduledAt })
      .returning();
    const assetId = crypto.randomUUID();
    const storageKey = `brands/${brandId}/${assetId}.png`;
    await storageOf().write(storageKey, new Uint8Array([1, 2, 3]));
    await db.insert(assets).values({ id: assetId, brandId, kind: 'image', storageKey, mimeType: 'image/png' });
    const [version] = await db
      .insert(itemVersions)
      .values({
        itemId: item!.id,
        number: 1,
        copy: { caption, hashtags: [], imageBrief: { prompt: 'p' } },
        assetIds: [assetId],
        author: 'planner',
      })
      .returning();
    await db.update(contentItems).set({ currentVersionId: version!.id }).where(eq(contentItems.id, item!.id));
    return item!;
  }

  it('stores a zip asset, records it on the run and marks items exported', async () => {
    const { brand, run, context, job } = await setup();
    const approved = await addItem(brand.id, 'approved', null, 'Plain post');
    const scheduled = await addItem(brand.id, 'scheduled', new Date('2026-12-01T09:00:00Z'), 'Timed post');
    const suggested = await addItem(brand.id, 'suggested', null, 'Not ready');

    await job.run({ brandId: brand.id, itemIds: [approved.id, scheduled.id, suggested.id] }, context);

    const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, run.id));
    expect(row!.resultAssetId).toBeTruthy();
    const [asset] = await db.select().from(assets).where(eq(assets.id, row!.resultAssetId!));
    expect(asset).toMatchObject({ kind: 'export', mimeType: 'application/zip', brandId: brand.id });
    expect(asset!.storageKey).toBe(`brands/${brand.id}/exports/${asset!.id}.zip`);

    const files = unzipSync(await storageOf().read(asset!.storageKey));
    expect(Object.keys(files).sort()).toEqual([
      '2026-12-01-instagram-timed-post/copy.txt',
      '2026-12-01-instagram-timed-post/image-1.png',
      'calendar.ics',
      'unscheduled-instagram-plain-post/copy.txt',
      'unscheduled-instagram-plain-post/image-1.png',
    ]);
    expect(strFromU8(files['calendar.ics']!)).toContain(`UID:${scheduled.id}@openlumo`);
    expect(progress).toContain('Packing export');

    const statuses = await db.select({ id: contentItems.id, status: contentItems.status }).from(contentItems);
    const statusOf = (id: string) => statuses.find((s) => s.id === id)!.status;
    expect(statusOf(approved.id)).toBe('exported');
    expect(statusOf(scheduled.id)).toBe('exported');
    expect(statusOf(suggested.id)).toBe('suggested');
  });

  it('ignores items from other brands', async () => {
    const { brand, context, job } = await setup();
    const other = await createBrand(db, { name: 'Other', createdBy: 'u1' });
    const foreign = await addItem(other.id, 'approved', null, 'Foreign');
    await expect(job.run({ brandId: brand.id, itemIds: [foreign.id] }, context)).rejects.toMatchObject({
      code: 'nothing_to_export',
      retryable: false,
    });
    const [row] = await db.select().from(contentItems).where(eq(contentItems.id, foreign.id));
    expect(row!.status).toBe('approved');
  });

  it('fails without creating an asset when nothing is exportable', async () => {
    const { brand, context, job } = await setup();
    const suggested = await addItem(brand.id, 'suggested', null, 'Not ready');
    const before = await db.select().from(assets);
    await expect(job.run({ brandId: brand.id, itemIds: [suggested.id] }, context)).rejects.toMatchObject({
      code: 'nothing_to_export',
      retryable: false,
    });
    expect(await db.select().from(assets)).toHaveLength(before.length);
  });
});
