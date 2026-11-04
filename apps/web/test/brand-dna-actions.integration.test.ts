import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  addBrandMember,
  createBrand,
  createPartialBrandDna,
  createQueue,
  getBrandDna,
  listOpenFeedbackNotes,
  saveBrandDna,
  type Queue,
} from '@openlumo/core';
import { brands, jobRuns, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { addFeedback, requestFeedbackMerge, updateBrandDna } from '../src/features/brand-dna/dna-service';
import { createStrategyForBrand, planMore } from '../src/features/strategy/strategy-service';

describe('brand dna and strategy actions', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let boss: Queue;
  let brandId: string;

  const owner = { id: 'owner' };
  const viewer = { id: 'viewer' };
  const stranger = { id: 'stranger' };
  const context = (user: { id: string }) => ({ db: database.db, boss, user });

  beforeAll(async () => {
    database = await createTestDatabase();
    boss = await createQueue(database.url, { createQueues: true, supervise: false, schedule: false });
    for (const id of ['owner', 'viewer', 'stranger']) {
      await database.db.insert(users).values({ id, name: id, email: `${id}@example.com` });
    }
    const brand = await createBrand(database.db, { name: 'Acme', createdBy: 'owner' });
    brandId = brand.id;
    await addBrandMember(database.db, brandId, 'viewer', 'viewer');
  });

  afterAll(async () => {
    await boss.stop();
    await database.drop();
  });

  const validDna = () => createPartialBrandDna({ name: 'Acme', palette: ['#ff5a1f'] });

  async function statusOf() {
    const [brand] = await database.db.select().from(brands).where(eq(brands.id, brandId));
    return brand?.status;
  }

  function runsOf(type: string) {
    return database.db
      .select()
      .from(jobRuns)
      .then((rows) => rows.filter((run) => run.brandId === brandId && run.type === type));
  }

  it('returns field errors keyed by path for an invalid DNA', async () => {
    const dna = validDna();
    dna.voice.tone.formalToCasual = 11;
    const result = await updateBrandDna(context(owner), brandId, dna);
    expect(result).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(result.ok ? {} : result.fieldErrors).toHaveProperty(['voice.tone.formalToCasual']);
  });

  it('rejects palette entries that are not lowercase hex colours', async () => {
    const dna = validDna();
    dna.visuals.palette = ['#ff5a1f', 'red'];
    const result = await updateBrandDna(context(owner), brandId, dna);
    expect(result.ok ? {} : result.fieldErrors).toHaveProperty(['visuals.palette.1']);
  });

  it('rejects viewers and non-members', async () => {
    expect(await updateBrandDna(context(viewer), brandId, validDna())).toEqual({ ok: false, error: 'forbidden' });
    expect(await updateBrandDna(context(stranger), brandId, validDna())).toEqual({ ok: false, error: 'forbidden' });
    expect(await addFeedback(context(viewer), brandId, 'note')).toEqual({ ok: false, error: 'forbidden' });
    expect(await requestFeedbackMerge(context(viewer), brandId)).toEqual({ ok: false, error: 'forbidden' });
    expect(await getBrandDna(database.db, brandId)).toBeNull();
  });

  it('sets a needs_input brand to ready when the DNA is saved', async () => {
    expect(await statusOf()).toBe('needs_input');
    expect(await updateBrandDna(context(owner), brandId, validDna())).toEqual({ ok: true });
    expect(await statusOf()).toBe('ready');
    expect((await getBrandDna(database.db, brandId))?.dna.identity.name).toBe('Acme');
  });

  it('stores feedback notes and collapses repeated merge requests for the same DNA version', async () => {
    expect(await addFeedback(context(owner), brandId, '   ')).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await addFeedback(context(owner), brandId, 'Sound friendlier')).toEqual({ ok: true });
    expect(await listOpenFeedbackNotes(database.db, brandId)).toHaveLength(1);

    await requestFeedbackMerge(context(owner), brandId);
    await requestFeedbackMerge(context(owner), brandId);
    const runs = await runsOf('brand.synthesize-dna');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.idempotencyKey).toBe(`merge-feedback:${brandId}:1`);

    await saveBrandDna(database.db, brandId, validDna());
    await requestFeedbackMerge(context(owner), brandId);
    expect(await runsOf('brand.synthesize-dna')).toHaveLength(2);
  });

  it('validates and enqueues strategy creation for editors only', async () => {
    expect(await createStrategyForBrand(context(viewer), brandId, 'leads', ['email'])).toEqual({
      ok: false,
      error: 'forbidden',
    });
    const bad = await createStrategyForBrand(context(owner), brandId, 'fame', []);
    expect(bad).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(bad.ok ? {} : bad.fieldErrors).toHaveProperty(['goal']);
    expect(bad.ok ? {} : bad.fieldErrors).toHaveProperty(['channels']);
    expect(await runsOf('strategy.create')).toHaveLength(0);

    expect(await createStrategyForBrand(context(owner), brandId, 'leads', ['email', 'linkedin'])).toEqual({ ok: true });
    const [run] = await runsOf('strategy.create');
    expect(run?.idempotencyKey).toBeNull();
  });

  it('collapses "Plan more" to one run per UTC day', async () => {
    const day = new Date('2026-11-04T23:30:00Z');
    await planMore(context(owner), brandId, day);
    await planMore(context(owner), brandId, day);
    await planMore(context(owner), brandId, new Date('2026-11-05T00:10:00Z'));
    const keys = (await runsOf('plan.top-up')).map((run) => run.idempotencyKey).sort();
    expect(keys).toEqual([`top-up:${brandId}:2026-11-04`, `top-up:${brandId}:2026-11-05`]);
    expect(await planMore(context(viewer), brandId)).toEqual({ ok: false, error: 'forbidden' });
  });
});
