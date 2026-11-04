import type { Metadata } from 'next';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { InviteMember } from '@/features/brands/invite-member';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Members' };

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { db, user } = await getServerContext();
  await requireBrandAccessOrNotFound(db, user.id, brandId, 'owner');
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Members</h1>
      <InviteMember brandId={brandId} />
    </div>
  );
}
