import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { ChatPanel } from '@/features/chat/chat-panel';
import { MAX_CHAT_MESSAGE_LENGTH } from '@/features/chat/chat-service';
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
  const membership = await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  return (
    <>
      {children}
      <ChatPanel
        key={brandId}
        brandId={brandId}
        canSend={membership.role !== 'viewer'}
        maxLength={MAX_CHAT_MESSAGE_LENGTH}
      />
    </>
  );
}
