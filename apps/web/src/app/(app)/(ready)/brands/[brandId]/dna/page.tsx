import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPartialBrandDna, findBrand, getBrandDna, getResearch, listOpenFeedbackNotes } from '@openlumo/core';
import { DnaForm } from '@/features/brand-dna/dna-form';
import { FeedbackPanel } from '@/features/brand-dna/feedback-panel';
import { ResearchPanel } from '@/features/brand-dna/research-panel';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { EmptyState } from '@/components/empty-state';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Brand DNA' };

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { db, user } = await getServerContext();
  const membership = await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  const brand = await findBrand(db, brandId);
  if (!brand) notFound();
  const saved = await getBrandDna(db, brandId);
  const dna = saved?.dna ?? createPartialBrandDna({ name: brand.name ?? '', palette: [] });
  const notes = await listOpenFeedbackNotes(db, brandId);
  const canEdit = membership.role !== 'viewer';
  const research = await getResearch(db, brandId);

  return (
    <div className="flex flex-col gap-6">
      {brand.status === 'needs_input' ? (
        <EmptyState
          spot="needs-input"
          title="Tell us about your brand"
          description="We could not learn everything from your site. Fill in what you know and Lumo will take it from there."
        />
      ) : (
        <h1 className="text-2xl font-bold tracking-tight">Brand DNA</h1>
      )}
      {brand.url && (
        <ResearchPanel
          brandId={brandId}
          canRefresh={canEdit}
          research={
            research && {
              status: research.status,
              sources: research.sources,
              researchedAt: research.researchedAt?.toISOString() ?? null,
            }
          }
        />
      )}
      <DnaForm key={saved?.version ?? 0} brandId={brandId} initial={dna} canEdit={canEdit} />
      {saved && <FeedbackPanel brandId={brandId} notes={notes} canEdit={canEdit} />}
    </div>
  );
}
