import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { brandDna, brands, contentItems, itemVersions, users } from '../src';
import { createTestDatabase } from '../src/testing';

describe('database schema', () => {
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.drop();
  });

  async function insertItemWithOneVersion() {
    const { db } = testDatabase;
    const [user] = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), name: 'Ada', email: `${crypto.randomUUID()}@example.com` })
      .returning();
    const [brand] = await db.insert(brands).values({ name: 'Acme', url: 'https://acme.test', createdBy: user!.id }).returning();
    const [item] = await db
      .insert(contentItems)
      .values({ brandId: brand!.id, channel: 'linkedin', format: 'social_post' })
      .returning();
    await db.insert(itemVersions).values({ itemId: item!.id, number: 1, copy: { text: 'first' }, author: 'planner' });
    return { brand: brand!, item: item! };
  }

  it('stores a brand with its dna and a versioned item', async () => {
    const { db } = testDatabase;
    const { brand, item } = await insertItemWithOneVersion();
    await db.insert(brandDna).values({ brandId: brand.id, data: { voice: 'warm' } });
    await db.insert(itemVersions).values({ itemId: item.id, number: 2, copy: { text: 'second' }, author: 'user', feedback: 'shorter' });

    const [storedBrand] = await db.select().from(brands).where(eq(brands.id, brand.id));
    const [storedDna] = await db.select().from(brandDna).where(eq(brandDna.brandId, brand.id));
    const versions = await db.select().from(itemVersions).where(eq(itemVersions.itemId, item.id)).orderBy(itemVersions.number);

    expect(storedBrand).toMatchObject({ name: 'Acme', url: 'https://acme.test', status: 'crawling' });
    expect(storedDna).toMatchObject({ data: { voice: 'warm' }, version: 1 });
    expect(versions.map((version) => version.copy)).toEqual([{ text: 'first' }, { text: 'second' }]);
    expect(versions[1]).toMatchObject({ number: 2, author: 'user', feedback: 'shorter' });
  });

  it('rejects a duplicate version number for the same item', async () => {
    const { db } = testDatabase;
    const { item } = await insertItemWithOneVersion();

    await expect(
      db.insert(itemVersions).values({ itemId: item.id, number: 1, copy: { text: 'again' }, author: 'user' }),
    ).rejects.toThrow();
  });
});
