import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { addBrandMember, createBrand, createQueue, type Queue } from '@openlumo/core';
import { assets, contentItems, itemVersions, jobRuns, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { generateOnDemand } from '../src/features/studio/studio-service';
import { exportItems, getExportRun } from '../src/features/export/export-service';

describe('studio and export actions', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let boss: Queue;
  let brandId: string;
  let otherBrandId: string;

  const editor = { id: 'editor' };
  const viewer = { id: 'viewer' };
  const stranger = { id: 'stranger' };
  const context = (user: { id: string }) => ({ db: database.db, boss, user });

  beforeAll(async () => {
    database = await createTestDatabase();
    boss = await createQueue(database.url, { createQueues: true, supervise: false, schedule: false });
    for (const id of ['editor', 'viewer', 'stranger']) {
      await database.db.insert(users).values({ id, name: id, email: `${id}@example.com` });
    }
    brandId = (await createBrand(database.db, { name: 'Acme', createdBy: 'editor' })).id;
    otherBrandId = (await createBrand(database.db, { name: 'Other', createdBy: 'stranger' })).id;
    await addBrandMember(database.db, brandId, 'viewer', 'viewer');
  });

  afterAll(async () => {
    await boss.stop();
    await database.drop();
  });

  async function createItem(status: (typeof contentItems.$inferSelect)['status'], brand = brandId) {
    const [item] = await database.db
      .insert(contentItems)
      .values({ brandId: brand, channel: 'instagram', format: 'social_post', status, scheduledAt: new Date() })
      .returning();
    const [version] = await database.db
      .insert(itemVersions)
      .values({
        itemId: item!.id,
        number: 1,
        copy: { caption: 'Hello', hashtags: [], imageBrief: { prompt: 'A shop' } },
        author: 'planner',
      })
      .returning();
    await database.db.update(contentItems).set({ currentVersionId: version!.id }).where(eq(contentItems.id, item!.id));
    return item!.id;
  }

  describe('generateOnDemand', () => {
    it('rejects five variants', async () => {
      const result = await generateOnDemand(context(editor), brandId, {
        channel: 'instagram',
        format: 'social_post',
        variants: 5,
      });
      expect(result).toMatchObject({ ok: false, error: 'invalid_input', fieldErrors: { variants: expect.any(String) } });
    });

    it('rejects a format the channel does not support', async () => {
      const result = await generateOnDemand(context(editor), brandId, { channel: 'email', format: 'carousel', variants: 1 });
      expect(result).toMatchObject({ ok: false, error: 'invalid_input', fieldErrors: { format: expect.any(String) } });
    });

    it('creates unscheduled in-review items and enqueues one generation each with the instruction', async () => {
      const result = await generateOnDemand(context(editor), brandId, {
        channel: 'linkedin',
        format: 'carousel',
        instruction: '  Launch week, playful  ',
        variants: 3,
      });
      if (!result.ok) throw new Error(result.error);
      expect(result.itemIds).toHaveLength(3);

      const items = await database.db.select().from(contentItems).where(inArray(contentItems.id, result.itemIds));
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item).toMatchObject({
          brandId,
          status: 'in_review',
          scheduledAt: null,
          strategyId: null,
          channel: 'linkedin',
          format: 'carousel',
        });
      }

      const runs = await database.db.select().from(jobRuns).where(inArray(jobRuns.itemId, result.itemIds));
      expect(runs.map((run) => run.idempotencyKey).sort()).toEqual(result.itemIds.map((id) => `generate:${id}:1`).sort());
      for (const run of runs) {
        const job = await boss.getJobById<Record<string, unknown>>('item.generate', run.id);
        expect(job?.data).toEqual({
          brandId,
          itemId: run.itemId,
          targetVersion: 1,
          instruction: 'Launch week, playful',
        });
      }
    });

    it('leaves the instruction out when it is blank', async () => {
      const result = await generateOnDemand(context(editor), brandId, {
        channel: 'x',
        format: 'social_post',
        instruction: '   ',
        variants: 1,
      });
      if (!result.ok) throw new Error(result.error);
      const [run] = await database.db.select().from(jobRuns).where(eq(jobRuns.itemId, result.itemIds[0]!));
      const job = await boss.getJobById<Record<string, unknown>>('item.generate', run!.id);
      expect(job?.data).not.toHaveProperty('instruction');
    });

    it('returns not_found for viewers and strangers without creating items', async () => {
      const before = await database.db.select().from(contentItems);
      for (const user of [viewer, stranger]) {
        expect(
          await generateOnDemand(context(user), brandId, { channel: 'instagram', format: 'social_post', variants: 1 }),
        ).toEqual({ ok: false, error: 'not_found' });
      }
      expect(await database.db.select().from(contentItems)).toHaveLength(before.length);
    });
  });

  describe('exportItems', () => {
    it('enqueues one export run per item set, keyed by the sorted ids', async () => {
      const ids = [await createItem('approved'), await createItem('scheduled')];
      const first = await exportItems(context(editor), brandId, ids);
      const second = await exportItems(context(editor), brandId, [...ids].reverse());
      if (!first.ok || !second.ok) throw new Error('export failed');
      expect(second.runId).toBe(first.runId);

      const digest = createHash('sha256').update([...ids].sort().join(',')).digest('hex');
      const [run] = await database.db.select().from(jobRuns).where(eq(jobRuns.id, first.runId));
      expect(run).toMatchObject({ type: 'export.bundle', brandId, idempotencyKey: `export:${brandId}:${digest}` });
      const job = await boss.getJobById<Record<string, unknown>>('export.bundle', first.runId);
      expect(job?.data).toEqual({ brandId, itemIds: ids });
    });

    it('rejects items that are not exportable or not in the brand', async () => {
      const approved = await createItem('approved');
      for (const itemIds of [
        [],
        ['not-a-uuid'],
        [approved, await createItem('in_review')],
        [approved, await createItem('approved', otherBrandId)],
        [approved, crypto.randomUUID()],
        Array.from({ length: 201 }, () => approved),
      ]) {
        expect(await exportItems(context(editor), brandId, itemIds)).toEqual({ ok: false, error: 'invalid_items' });
      }
    });

    it('returns not_found for viewers', async () => {
      const approved = await createItem('approved');
      expect(await exportItems(context(viewer), brandId, [approved])).toEqual({ ok: false, error: 'not_found' });
    });
  });

  describe('getExportRun', () => {
    it('shows the run status and result asset to viewers of the brand only', async () => {
      const exported = await exportItems(context(editor), brandId, [await createItem('approved')]);
      if (!exported.ok) throw new Error(exported.error);
      expect(await getExportRun(context(viewer), brandId, exported.runId)).toEqual({
        ok: true,
        status: 'queued',
        resultAssetId: null,
      });

      const [asset] = await database.db
        .insert(assets)
        .values({ brandId, kind: 'export', storageKey: 'brands/x/exports/a.zip', mimeType: 'application/zip' })
        .returning();
      await database.db
        .update(jobRuns)
        .set({ status: 'succeeded', resultAssetId: asset!.id })
        .where(eq(jobRuns.id, exported.runId));
      expect(await getExportRun(context(viewer), brandId, exported.runId)).toEqual({
        ok: true,
        status: 'succeeded',
        resultAssetId: asset!.id,
      });

      expect(await getExportRun(context(stranger), brandId, exported.runId)).toEqual({ ok: false, error: 'not_found' });
      expect(await getExportRun(context(stranger), otherBrandId, exported.runId)).toEqual({ ok: false, error: 'not_found' });
      expect(await getExportRun(context(viewer), brandId, 'nope')).toEqual({ ok: false, error: 'not_found' });
    });

    it('does not expose runs of other job types', async () => {
      const generated = await generateOnDemand(context(editor), brandId, {
        channel: 'instagram',
        format: 'social_post',
        variants: 1,
      });
      if (!generated.ok) throw new Error(generated.error);
      const [run] = await database.db.select().from(jobRuns).where(eq(jobRuns.itemId, generated.itemIds[0]!));
      expect(await getExportRun(context(editor), brandId, run!.id)).toEqual({ ok: false, error: 'not_found' });
    });
  });
});
