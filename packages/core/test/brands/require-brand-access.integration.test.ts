import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createBrand } from '../../src/brands/create-brand';
import { BrandAccessDeniedError, requireBrandAccess } from '../../src/brands/require-brand-access';
import { addBrandMember } from '../../src/brands/brand-repository';

describe('requireBrandAccess', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let brandId: string;

  async function addUser(id: string, role = 'member') {
    await db.insert(users).values({ id, name: id, email: `${id}@example.com`, role });
  }

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    await addUser('owner');
    await addUser('viewer');
    await addUser('stranger');
    await addUser('admin', 'admin');
    brandId = (await createBrand(db, { name: 'Acme', createdBy: 'owner' })).id;
    await addBrandMember(db, brandId, 'viewer', 'viewer');
  });

  afterAll(async () => {
    await drop();
  });

  it('lets an owner pass every minimum role', async () => {
    for (const minimum of ['viewer', 'editor', 'owner'] as const) {
      await expect(requireBrandAccess(db, 'owner', brandId, minimum)).resolves.toMatchObject({ role: 'owner' });
    }
  });

  it('lets a viewer read but not edit', async () => {
    await expect(requireBrandAccess(db, 'viewer', brandId, 'viewer')).resolves.toMatchObject({ role: 'viewer' });
    await expect(requireBrandAccess(db, 'viewer', brandId, 'editor')).rejects.toBeInstanceOf(BrandAccessDeniedError);
  });

  it('denies a non-member', async () => {
    await expect(requireBrandAccess(db, 'stranger', brandId, 'viewer')).rejects.toMatchObject({
      code: 'brand_access_denied',
      retryable: false,
    });
  });

  it('lets an instance admin pass without membership', async () => {
    await expect(requireBrandAccess(db, 'admin', brandId, 'owner')).resolves.toMatchObject({
      brandId,
      userId: 'admin',
      role: 'owner',
    });
  });
});
