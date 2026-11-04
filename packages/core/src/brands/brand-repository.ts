import { eq } from 'drizzle-orm';
import { brandMembers, brands, type Database } from '@openlumo/db';
import type { Brand } from './create-brand';
import type { MemberRole } from './require-brand-access';

export async function findBrand(db: Database, brandId: string): Promise<Brand | undefined> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  return brand;
}

export async function setBrandStatus(db: Database, brandId: string, status: Brand['status']): Promise<void> {
  await db.update(brands).set({ status }).where(eq(brands.id, brandId));
}

export async function addBrandMember(
  db: Database,
  brandId: string,
  userId: string,
  role: MemberRole,
): Promise<boolean> {
  const inserted = await db
    .insert(brandMembers)
    .values({ brandId, userId, role })
    .onConflictDoNothing()
    .returning({ userId: brandMembers.userId });
  return inserted.length > 0;
}
