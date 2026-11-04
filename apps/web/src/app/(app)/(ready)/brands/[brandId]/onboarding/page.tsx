import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { findBrand } from '@openlumo/core';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { OnboardingProgress } from '@/features/brands/onboarding-progress';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Getting started' };

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { db, user } = await getServerContext();
  await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  const brand = await findBrand(db, brandId);
  if (!brand) notFound();
  if (brand.status !== 'crawling') redirect(`/brands/${brandId}/dna`);
  return <OnboardingProgress brandId={brandId} />;
}
