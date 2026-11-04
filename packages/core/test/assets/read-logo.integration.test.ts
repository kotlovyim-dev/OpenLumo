import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assets, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { createBrand } from '../../src/brands/create-brand';
import { createAssetStorage } from '../../src/assets/asset-storage';
import { readLogo } from '../../src/assets/read-logo';

describe('readLogo', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let directory: string;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    directory = await mkdtemp(path.join(tmpdir(), 'openlumo-logo-'));
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
    await drop();
  });

  it('returns the stored logo bytes, or undefined when none is set or the asset is missing', async () => {
    const storage = createAssetStorage(directory);
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    const [logo] = await db
      .insert(assets)
      .values({ brandId: brand.id, kind: 'logo', storageKey: `brands/${brand.id}/logo.png`, mimeType: 'image/png' })
      .returning();
    await storage.write(logo!.storageKey, Uint8Array.from([1, 2, 3]));

    const withLogo = createPartialBrandDna({ name: 'Acme', palette: [], logoAssetId: logo!.id });
    const withoutLogo = createPartialBrandDna({ name: 'Acme', palette: [] });
    const missing = createPartialBrandDna({ name: 'Acme', palette: [], logoAssetId: crypto.randomUUID() });

    expect(Array.from((await readLogo(db, storage, withLogo))!)).toEqual([1, 2, 3]);
    expect(await readLogo(db, storage, withoutLogo)).toBeUndefined();
    expect(await readLogo(db, storage, missing)).toBeUndefined();
  });
});
