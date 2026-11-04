import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { brandMembers, brands } from '@openlumo/db';
import { getServerContext } from '@/lib/server-context';

export default async function Home() {
  const { db, user } = await getServerContext();
  const [first] = await db
    .select({ id: brands.id })
    .from(brandMembers)
    .innerJoin(brands, eq(brands.id, brandMembers.brandId))
    .where(eq(brandMembers.userId, user.id))
    .orderBy(asc(brands.createdAt))
    .limit(1);

  redirect(first ? `/brands/${first.id}/board` : '/brands/new');
}
