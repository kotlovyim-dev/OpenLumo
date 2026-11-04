import type { Metadata } from 'next';
import { channelFormats } from '@openlumo/core';
import { loadItemDetail, loadOnDemandCards } from '@/features/board/board-service';
import { ItemDetailSheet } from '@/features/board/item-detail-sheet';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { StudioForm } from '@/features/studio/studio-form';
import { StudioItems } from '@/features/studio/studio-items';
import { MAX_INSTRUCTION_LENGTH, MAX_VARIANTS } from '@/features/studio/studio-service';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Studio' };

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
  const cards = await loadOnDemandCards(db, brandId);
  const detail = typeof item === 'string' ? await loadItemDetail(db, brandId, item) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="text-sm text-muted">Make something on demand, outside the plan. Each variant lands in review.</p>
      </div>
      {canEdit && (
        <StudioForm
          brandId={brandId}
          channelFormats={channelFormats}
          maxInstructionLength={MAX_INSTRUCTION_LENGTH}
          maxVariants={MAX_VARIANTS}
        />
      )}
      <StudioItems brandId={brandId} cards={cards} canEdit={canEdit} />
      {detail && (
        <ItemDetailSheet
          key={`${detail.id}:${detail.currentVersionNumber}`}
          brandId={brandId}
          detail={detail}
          canEdit={canEdit}
          closeHref={`/brands/${brandId}/studio`}
        />
      )}
    </div>
  );
}
