import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { contentItems, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createBrand } from '../../src/brands/create-brand';
import { appendVersion } from '../../src/workspace/item-repository';

describe('appendVersion', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let brandId: string;

  const copy = (caption: string) => ({ caption, hashtags: [], imageBrief: { prompt: 'A shop' } });

  async function currentVersionOf(itemId: string) {
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, itemId));
    return item?.currentVersionId;
  }

  async function createItem() {
    const [item] = await db.insert(contentItems).values({ brandId, channel: 'instagram', format: 'social_post' }).returning();
    return item!.id;
  }

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
    await db.insert(users).values({ id: 'owner', name: 'owner', email: 'owner@example.com' });
    brandId = (await createBrand(db, { name: 'Acme', createdBy: 'owner' })).id;
  });

  afterAll(async () => {
    await drop();
  });

  it('moves only its own item to the new version', async () => {
    const first = await createItem();
    const second = await createItem();
    const firstVersion = await appendVersion(db, first, 1, { copy: copy('First'), author: 'planner' });
    const secondVersion = await appendVersion(db, second, 1, { copy: copy('Second'), author: 'planner' });
    const newer = await appendVersion(db, first, 2, { copy: copy('Edited'), author: 'user' });

    expect(firstVersion && secondVersion && newer).toBeTruthy();
    expect(await currentVersionOf(first)).toBe(newer?.id);
    expect(await currentVersionOf(second)).toBe(secondVersion?.id);
  });

  it('keeps a newer current version when an older number is appended late', async () => {
    const itemId = await createItem();
    const newer = await appendVersion(db, itemId, 2, { copy: copy('Two'), author: 'user' });
    await appendVersion(db, itemId, 1, { copy: copy('One'), author: 'planner' });
    expect(await currentVersionOf(itemId)).toBe(newer?.id);
  });
});
