import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { getServerContext } from '@/lib/server-context';

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const { db, user } = await getServerContext();
  await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  return children;
}
