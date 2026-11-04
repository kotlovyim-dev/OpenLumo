import { and, eq, sql } from 'drizzle-orm';
import { brandDna, type Database } from '@openlumo/db';
import { type BrandDna, brandDnaSchema } from './brand-dna-schema';

export async function saveBrandDna(db: Database, brandId: string, dna: BrandDna): Promise<void> {
  await db
    .insert(brandDna)
    .values({ brandId, data: dna })
    .onConflictDoUpdate({
      target: brandDna.brandId,
      set: { data: dna, version: sql`${brandDna.version} + 1`, updatedAt: new Date() },
    });
}

export async function getBrandDna(
  db: Database,
  brandId: string,
): Promise<{ dna: BrandDna; version: number } | null> {
  const [row] = await db.select().from(brandDna).where(eq(brandDna.brandId, brandId));
  if (!row) return null;
  return { dna: brandDnaSchema.parse(row.data), version: row.version };
}

export async function saveBrandDnaIfVersion(
  db: Database,
  brandId: string,
  dna: BrandDna,
  expectedVersion: number,
): Promise<boolean> {
  const updated = await db
    .update(brandDna)
    .set({ data: dna, version: sql`${brandDna.version} + 1`, updatedAt: new Date() })
    .where(and(eq(brandDna.brandId, brandId), eq(brandDna.version, expectedVersion)))
    .returning({ brandId: brandDna.brandId });
  return updated.length > 0;
}
