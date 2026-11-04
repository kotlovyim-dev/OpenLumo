import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createBrand } from '../../src/brands/create-brand';
import { getResearch, recordFailedResearch, saveResearch } from '../../src/research/research-repository';
import type { ResearchFindings } from '../../src/research/research-schema';

const findings: ResearchFindings = {
  name: 'Sunrise Bakery',
  features: ['Baked before 6am'],
  audience: { segments: ['Families'], painPoints: [], buyingTriggers: [], objections: [], channels: ['Instagram'] },
  competitors: [
    { name: 'Dawn Loaves', url: 'https://dawn.example', positioning: 'Cheap bread', strengths: [], weaknesses: [], sourceUrls: [] },
  ],
};

describe('research repository', () => {
  let db: Database;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
  });

  afterAll(async () => {
    await drop();
  });

  it('returns null before any research ran', async () => {
    const brand = await createBrand(db, { name: 'None', createdBy: 'u1' });
    expect(await getResearch(db, brand.id)).toBeNull();
  });

  it('saves and loads a successful run', async () => {
    const brand = await createBrand(db, { name: 'Saved', createdBy: 'u1' });
    const sources = [{ url: 'https://news.example/a', title: 'A' }];

    await saveResearch(db, brand.id, { brief: 'The brief', sources, findings });

    const research = await getResearch(db, brand.id);
    expect(research).toMatchObject({ status: 'succeeded', brief: 'The brief', sources, findings });
    expect(research?.researchedAt).toBeInstanceOf(Date);
    expect(research?.attemptedAt).toEqual(research?.researchedAt);
  });

  it('keeps the previous findings when a later attempt fails', async () => {
    const brand = await createBrand(db, { name: 'Kept', createdBy: 'u1' });
    await saveResearch(db, brand.id, { brief: 'Old brief', sources: [], findings });
    const before = await getResearch(db, brand.id);

    await recordFailedResearch(db, brand.id);

    const after = await getResearch(db, brand.id);
    expect(after).toMatchObject({ status: 'failed', brief: 'Old brief', findings });
    expect(after?.researchedAt).toEqual(before?.researchedAt);
    expect(after!.attemptedAt.getTime()).toBeGreaterThanOrEqual(before!.attemptedAt.getTime());
  });

  it('records a failed first attempt with no findings', async () => {
    const brand = await createBrand(db, { name: 'Failed', createdBy: 'u1' });

    await recordFailedResearch(db, brand.id);

    expect(await getResearch(db, brand.id)).toMatchObject({
      status: 'failed',
      brief: '',
      sources: [],
      findings: null,
      researchedAt: null,
    });
  });
});
