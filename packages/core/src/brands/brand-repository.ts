import { eq } from 'drizzle-orm';
import { brands, type Database } from '@openlumo/db';
import type { Brand } from './create-brand';

export async function findBrand(db: Database, brandId: string): Promise<Brand | undefined> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  return brand;
}

export async function setBrandStatus(db: Database, brandId: string, status: Brand['status']): Promise<void> {
  await db.update(brands).set({ status }).where(eq(brands.id, brandId));
}
