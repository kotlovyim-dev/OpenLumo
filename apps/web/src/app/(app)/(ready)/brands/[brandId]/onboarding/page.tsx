import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { findBrand, getResearch, loadCrawlSources } from '@openlumo/core';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { describeDiscoveries } from '@/features/brands/onboarding-discoveries';
import { OnboardingProgress } from '@/features/brands/onboarding-progress';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Getting started' };

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { db, user } = await getServerContext();
  await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  const brand = await findBrand(db, brandId);
  if (!brand) notFound();
  if (brand.status === 'ready') redirect(`/brands/${brandId}/dna?welcome=1`);
  if (brand.status !== 'crawling') redirect(`/brands/${brandId}/dna`);
  const [crawl, research] = await Promise.all([loadCrawlSources(db, brandId), getResearch(db, brandId)]);
  return <OnboardingProgress brandId={brandId} discoveries={describeDiscoveries(brand.url ?? '', crawl, research)} />;
}
