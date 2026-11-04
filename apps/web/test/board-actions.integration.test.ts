import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { addBrandMember, createBrand, createQueue, type Queue } from '@openlumo/core';
import { contentItems, dnaFeedback, itemVersions, jobRuns, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import {
  approveItem,
  editItemCopy,
  regenerateItem,
  rejectItem,
  restoreVersion,
  scheduleItem,
} from '../src/features/board/item-service';

vi.mock('server-only', () => ({}));

const { loadBoard, loadItemDetail } = await import('../src/features/board/board-service');

const socialCopy = (caption: string) => ({ caption, hashtags: ['#acme'], imageBrief: { prompt: 'A sunny shop' } });

describe('board actions', () => {
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

  async function createItem({
    status = 'in_review',
    scheduledAt = null,
    assetIds = [],
    brand = brandId,
  }: {
    status?: (typeof contentItems.$inferSelect)['status'];
    scheduledAt?: Date | null;
    assetIds?: string[];
    brand?: string;
  } = {}) {
    const [item] = await database.db
      .insert(contentItems)
      .values({ brandId: brand, channel: 'instagram', format: 'social_post', status, scheduledAt })
      .returning();
    const [version] = await database.db
      .insert(itemVersions)
      .values({ itemId: item!.id, number: 1, copy: socialCopy('First caption'), assetIds, author: 'planner' })
      .returning();
    await database.db.update(contentItems).set({ currentVersionId: version!.id }).where(eq(contentItems.id, item!.id));
    return item!.id;
  }

  async function itemOf(itemId: string) {
    const [item] = await database.db.select().from(contentItems).where(eq(contentItems.id, itemId));
    return item!;
  }

  function versionsOf(itemId: string) {
    return database.db.select().from(itemVersions).where(eq(itemVersions.itemId, itemId)).orderBy(asc(itemVersions.number));
  }

  it('approves into scheduled when the item has a schedule, otherwise into approved', async () => {
    const scheduled = await createItem({ scheduledAt: new Date('2026-12-01T09:00:00Z') });
    const unscheduled = await createItem({ status: 'suggested' });
    expect(await approveItem(context(editor), scheduled)).toEqual({ ok: true });
    expect(await approveItem(context(editor), unscheduled)).toEqual({ ok: true });
    expect((await itemOf(scheduled)).status).toBe('scheduled');
    expect((await itemOf(unscheduled)).status).toBe('approved');
    expect(await approveItem(context(editor), unscheduled)).toEqual({ ok: false, error: 'invalid_transition' });
  });

  it('appends version n+1 by the user, keeping the image, when copy is edited', async () => {
    const assetId = randomUUID();
    const itemId = await createItem({ status: 'suggested', assetIds: [assetId] });
    expect(await editItemCopy(context(editor), itemId, socialCopy('Edited caption'))).toEqual({ ok: true });

    const versions = await versionsOf(itemId);
    expect(versions.map((version) => [version.number, version.author])).toEqual([
      [1, 'planner'],
      [2, 'user'],
    ]);
    expect(versions[1]?.copy).toEqual(socialCopy('Edited caption'));
    expect(versions[1]?.assetIds).toEqual([assetId]);
    const item = await itemOf(itemId);
    expect(item.currentVersionId).toBe(versions[1]?.id);
    expect(item.status).toBe('in_review');
  });

  it('returns field errors keyed by path for invalid copy and appends nothing', async () => {
    const itemId = await createItem();
    const result = await editItemCopy(context(editor), itemId, { caption: '', hashtags: ['#a'], imageBrief: {} });
    expect(result).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(result.ok ? {} : result.fieldErrors).toHaveProperty(['caption']);
    expect(result.ok ? {} : result.fieldErrors).toHaveProperty(['imageBrief.prompt']);
    expect(await versionsOf(itemId)).toHaveLength(1);
  });

  it('rejects with a reason stored as DNA feedback for the item', async () => {
    const itemId = await createItem();
    expect(await rejectItem(context(editor), itemId, '   ')).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await rejectItem(context(editor), itemId, 'x'.repeat(501))).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await rejectItem(context(editor), itemId, '  Too salesy  ')).toEqual({ ok: true });

    expect((await itemOf(itemId)).status).toBe('rejected');
    const notes = await database.db.select().from(dnaFeedback).where(eq(dnaFeedback.itemId, itemId));
    expect(notes).toMatchObject([{ brandId, note: 'Too salesy', merged: false }]);
  });

  it('collapses a double regenerate click into one run', async () => {
    const itemId = await createItem({ status: 'suggested' });
    const first = await regenerateItem(context(editor), itemId, 'image', 'Brighter');
    const second = await regenerateItem(context(editor), itemId, 'image', 'Brighter');
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    const runs = await database.db.select().from(jobRuns).where(eq(jobRuns.itemId, itemId));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.type).toBe('item.regenerate');
    expect((await itemOf(itemId)).status).toBe('in_review');
    expect(await regenerateItem(context(editor), itemId, 'everything')).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('schedules approved items and reschedules reviewable ones', async () => {
    const approved = await createItem({ status: 'approved' });
    const inReview = await createItem();
    const rejected = await createItem({ status: 'rejected' });
    const when = '2026-12-05T10:30:00.000Z';

    expect(await scheduleItem(context(editor), approved, when)).toEqual({ ok: true });
    expect(await itemOf(approved)).toMatchObject({ status: 'scheduled', scheduledAt: new Date(when) });
    expect(await scheduleItem(context(editor), approved, '2026-12-06T08:00:00+02:00')).toEqual({ ok: true });
    expect(await itemOf(approved)).toMatchObject({ status: 'scheduled', scheduledAt: new Date('2026-12-06T06:00:00Z') });

    expect(await scheduleItem(context(editor), inReview, when)).toEqual({ ok: true });
    expect(await itemOf(inReview)).toMatchObject({ status: 'in_review', scheduledAt: new Date(when) });

    expect(await scheduleItem(context(editor), rejected, when)).toEqual({ ok: false, error: 'invalid_transition' });
    expect(await scheduleItem(context(editor), inReview, 'tomorrow')).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('restores an older version as a new user version with its copy and assets', async () => {
    const assetId = randomUUID();
    const itemId = await createItem({ assetIds: [assetId] });
    await editItemCopy(context(editor), itemId, socialCopy('Second caption'));
    expect(await restoreVersion(context(editor), itemId, 1)).toEqual({ ok: true });
    expect(await restoreVersion(context(editor), itemId, 9)).toEqual({ ok: false, error: 'not_found' });

    const versions = await versionsOf(itemId);
    expect(versions).toHaveLength(3);
    expect(versions[2]).toMatchObject({ number: 3, author: 'user', copy: socialCopy('First caption'), assetIds: [assetId] });
    expect((await itemOf(itemId)).currentVersionId).toBe(versions[2]?.id);
  });

  it('denies viewers, strangers and unknown items on every action', async () => {
    const itemId = await createItem({ status: 'approved' });
    const otherItem = await createItem({ brand: otherBrandId });
    const notFound = { ok: false, error: 'not_found' };
    for (const [user, id] of [
      [viewer, itemId],
      [stranger, itemId],
      [editor, otherItem],
      [editor, randomUUID()],
      [editor, 'not-a-uuid'],
    ] as const) {
      expect(await approveItem(context(user), id)).toEqual(notFound);
      expect(await rejectItem(context(user), id, 'No')).toEqual(notFound);
      expect(await editItemCopy(context(user), id, socialCopy('Hacked'))).toEqual(notFound);
      expect(await regenerateItem(context(user), id, 'all')).toEqual(notFound);
      expect(await scheduleItem(context(user), id, '2026-12-05T10:30:00Z')).toEqual(notFound);
      expect(await restoreVersion(context(user), id, 1)).toEqual(notFound);
    }
    expect(await itemOf(itemId)).toMatchObject({ status: 'approved', scheduledAt: null });
    expect(await versionsOf(itemId)).toHaveLength(1);
    expect(await database.db.select().from(jobRuns).where(eq(jobRuns.itemId, itemId))).toHaveLength(0);
  });

  it('loads board cards with title, first image and latest run, hiding rejected items', async () => {
    const boardBrand = (await createBrand(database.db, { name: 'Board', createdBy: 'editor' })).id;
    const assetId = randomUUID();
    const shown = await createItem({ brand: boardBrand, assetIds: [assetId, randomUUID()] });
    await createItem({ brand: boardBrand, status: 'rejected' });
    await database.db.insert(jobRuns).values([
      { brandId: boardBrand, itemId: shown, type: 'item.generate', status: 'succeeded', costUsd: 0.01, createdAt: new Date('2026-11-01T00:00:00Z') },
      { brandId: boardBrand, itemId: shown, type: 'item.regenerate', status: 'failed', step: 'Rendering image', errorCode: 'provider_timeout', costUsd: 0.0425, createdAt: new Date('2026-11-02T00:00:00Z') },
    ]);

    const cards = await loadBoard(database.db, boardBrand);
    expect(cards).toEqual([
      expect.objectContaining({
        id: shown,
        status: 'in_review',
        title: 'First caption',
        imageAssetId: assetId,
        run: { status: 'failed', step: 'Rendering image', errorCode: 'provider_timeout', costUsd: 0.0425 },
      }),
    ]);

    expect(await loadItemDetail(database.db, brandId, shown)).toBeNull();
    const detail = await loadItemDetail(database.db, boardBrand, shown);
    expect(detail?.versions.map((version) => version.number)).toEqual([1]);
    expect(detail?.currentVersionNumber).toBe(1);
  });
});
