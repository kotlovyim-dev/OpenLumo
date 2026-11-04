import { asc, eq } from 'drizzle-orm';
import { brandMembers, brands } from '@openlumo/db';
import { AppShell } from '@/components/app-shell/app-shell';
import { getServerContext } from '@/lib/server-context';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user } = await getServerContext();
  const memberBrands = await db
    .select({ id: brands.id, name: brands.name })
    .from(brandMembers)
    .innerJoin(brands, eq(brands.id, brandMembers.brandId))
    .where(eq(brandMembers.userId, user.id))
    .orderBy(asc(brands.createdAt));

  return (
    <AppShell brands={memberBrands} user={user}>
      {children}
    </AppShell>
  );
}
