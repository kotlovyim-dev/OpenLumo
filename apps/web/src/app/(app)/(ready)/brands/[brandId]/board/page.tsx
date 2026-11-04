import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { BoardColumns } from '@/features/board/board-columns';
import { loadBoard, loadItemDetail } from '@/features/board/board-service';
import { ItemDetailSheet } from '@/features/board/item-detail-sheet';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Board' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { brandId } = await params;
  const { item } = await searchParams;
  const { db, user } = await getServerContext();
  const membership = await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  const canEdit = membership.role !== 'viewer';
  const cards = await loadBoard(db, brandId);
  const detail = typeof item === 'string' ? await loadItemDetail(db, brandId, item) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Board</h1>
      <BoardColumns
        brandId={brandId}
        cards={cards}
        canEdit={canEdit}
        empty={
          <EmptyState
            spot="empty-board"
            title="Your board is empty"
            description="Pick a goal and channels on the strategy page, and Lumo will plan and draft your first posts."
            action={
              <Link href={`/brands/${brandId}/strategy`} className={buttonVariants()}>
                Go to strategy
              </Link>
            }
          />
        }
      />
      {detail && (
        <ItemDetailSheet
          key={`${detail.id}:${detail.currentVersionNumber}`}
          brandId={brandId}
          detail={detail}
          canEdit={canEdit}
          closeHref={`/brands/${brandId}/board`}
        />
      )}
    </div>
  );
}
