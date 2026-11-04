'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useJobEvents } from '@/hooks/use-job-events';

const watched = new Set(['strategy.create', 'plan.month', 'plan.top-up', 'brand.synthesize-dna']);

export function StrategyProgress({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<string | null>(null);

  useJobEvents(brandId, (event) => {
    if (!watched.has(event.type)) return;
    if (event.status === 'succeeded' || event.status === 'failed') {
      setStep(null);
      router.refresh();
      return;
    }
    if (event.step) setStep(event.step);
  });

  return (
    <p aria-live="polite" className="min-h-5 text-sm text-muted">
      {step}
    </p>
  );
}
