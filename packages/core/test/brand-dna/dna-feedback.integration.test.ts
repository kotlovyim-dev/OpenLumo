import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeProvider } from '@openlumo/providers';
import { dnaFeedback, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { addDnaFeedback, listOpenFeedback, listOpenFeedbackNotes, markFeedbackMerged, mergeFeedback } from '../../src/brand-dna/dna-feedback';
import { getBrandDna, saveBrandDna } from '../../src/brand-dna/brand-dna-repository';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { fakeResponses } from '../../src/models/fake-responses';
import { createBrand } from '../../src/brands/create-brand';

describe('dna feedback', () => {
  let db: Database;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
  });

  afterAll(async () => {
    await drop();
  });

  it('returns unmerged notes of the brand newest first, at most 20', async () => {
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    const other = await createBrand(db, { name: 'Other', createdBy: 'u1' });
    const start = Date.parse('2026-11-01T00:00:00Z');
    await db.insert(dnaFeedback).values([
      ...Array.from({ length: 22 }, (_, index) => ({
        brandId: brand.id,
        note: `note ${index}`,
        createdAt: new Date(start + index * 1000),
      })),
      { brandId: brand.id, note: 'merged', merged: true, createdAt: new Date(start + 99_000) },
      { brandId: other.id, note: 'other brand', createdAt: new Date(start + 98_000) },
    ]);

    const notes = await listOpenFeedback(db, brand.id);

    expect(notes).toHaveLength(20);
    expect(notes[0]).toBe('note 21');
    expect(notes).not.toContain('merged');
    expect(notes).not.toContain('other brand');
  });

  it('lists open notes with their ids', async () => {
    const brand = await createBrand(db, { name: 'Ids', createdBy: 'u1' });
    const id = await addDnaFeedback(db, brand.id, 'warmer');
    const mergedId = await addDnaFeedback(db, brand.id, 'old');
    await markFeedbackMerged(db, brand.id, [mergedId]);

    expect(await listOpenFeedbackNotes(db, brand.id)).toEqual([{ id, note: 'warmer' }]);
  });

  function capturingBrain() {
    return new FakeProvider({
      respond: (request) => JSON.stringify(fakeResponses[request.jsonSchema!.name]!(request)),
    });
  }

  it('merges open notes into the dna, bumps its version and marks the notes merged', async () => {
    const brand = await createBrand(db, { name: 'Merge', createdBy: 'u1' });
    await saveBrandDna(db, brand.id, createPartialBrandDna({ name: 'Merge', palette: [] }));
    const ids = [await addDnaFeedback(db, brand.id, 'be more playful'), await addDnaFeedback(db, brand.id, 'avoid jargon')];
    const brain = capturingBrain();

    const before = await getBrandDna(db, brand.id);
    const { dna } = await mergeFeedback(brain, 'fake/text', before!.dna, await listOpenFeedback(db, brand.id));
    await saveBrandDna(db, brand.id, dna);
    await markFeedbackMerged(db, brand.id, ids);

    const prompt = JSON.stringify(brain.requests[0]);
    expect(prompt).toContain('be more playful');
    expect(prompt).toContain('avoid jargon');
    const after = await getBrandDna(db, brand.id);
    expect(after?.version).toBe(before!.version + 1);
    expect(after?.dna.identity.name).toBe('Sunrise Bakery');
    expect(await listOpenFeedback(db, brand.id)).toEqual([]);
  });

  it('keeps the logo asset of the current dna', async () => {
    const logoAssetId = crypto.randomUUID();
    const dna = createPartialBrandDna({ name: 'Logo', palette: [], logoAssetId });

    const merged = await mergeFeedback(capturingBrain(), 'fake/text', dna, ['x']);

    expect(merged.dna.visuals.logoAssetId).toBe(logoAssetId);
  });
});
