import type { Metadata } from 'next';
import { findLatestStrategyId, findStrategy, strategyDocumentSchema } from '@openlumo/core';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { PlanMoreButton } from '@/features/strategy/plan-more-button';
import { StrategyPicker } from '@/features/strategy/strategy-picker';
import { StrategyProgress } from '@/features/strategy/strategy-progress';
import { StrategyView } from '@/features/strategy/strategy-view';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Strategy' };

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { db, user } = await getServerContext();
  const membership = await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  const canEdit = membership.role !== 'viewer';
  const strategyId = await findLatestStrategyId(db, brandId);
  const strategy = strategyId ? await findStrategy(db, strategyId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Strategy</h1>
        {strategy && canEdit && <PlanMoreButton brandId={brandId} />}
      </div>
      <StrategyProgress brandId={brandId} />
      {strategy ? (
        <StrategyView document={strategyDocumentSchema.parse(strategy.document)} />
      ) : canEdit ? (
        <StrategyPicker brandId={brandId} />
      ) : (
        <p className="text-sm text-muted">No strategy has been created for this brand yet.</p>
      )}
    </div>
  );
}
