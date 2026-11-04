'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { useJobEvents } from '@/hooks/use-job-events';

const watched = new Set(['brand.crawl', 'brand.research', 'brand.synthesize-dna']);

export function OnboardingProgress({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [step, setStep] = useState('Reading your site');

  useJobEvents(brandId, (event) => {
    if (!watched.has(event.type)) return;
    if (event.status === 'failed' || (event.type === 'brand.synthesize-dna' && event.status === 'succeeded')) {
      router.push(`/brands/${brandId}/dna`);
      return;
    }
    if (event.type === 'brand.crawl' && event.status === 'succeeded') {
      router.refresh();
      return;
    }
    if (event.step) setStep(event.step);
  }, () => router.refresh());

  return (
    <div aria-live="polite">
      <EmptyState
        spot="reading-site"
        title={step}
        description="Lumo is reading your site and researching your market on the web. This usually takes a minute or two."
      />
    </div>
  );
}
