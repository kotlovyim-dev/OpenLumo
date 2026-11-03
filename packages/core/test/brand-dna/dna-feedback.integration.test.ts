import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dnaFeedback, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { listOpenFeedback } from '../../src/brand-dna/dna-feedback';
import { createBrand } from '../../src/brands/create-brand';

describe('listOpenFeedback', () => {
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
});
