import { brandMembers, brands, type Database } from '@openlumo/db';

export type Brand = typeof brands.$inferSelect;

export async function createBrand(
  db: Database,
  input: { name?: string; url?: string; createdBy: string },
): Promise<Brand> {
  const name = input.name?.trim() || (input.url ? new URL(input.url).hostname : 'Untitled brand');
  return db.transaction(async (tx) => {
    const [brand] = await tx
      .insert(brands)
      .values({
        name,
        url: input.url ?? null,
        status: input.url ? 'crawling' : 'needs_input',
        createdBy: input.createdBy,
      })
      .returning();
    await tx.insert(brandMembers).values({ brandId: brand!.id, userId: input.createdBy, role: 'owner' });
    return brand!;
  });
}
