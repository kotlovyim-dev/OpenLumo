'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useJobEvents } from '@/hooks/use-job-events';
import { cn } from '@/lib/utils';
import { DiscoveryFeed } from './discovery-feed';
import type { OnboardingDiscoveries, OnboardingStage } from './onboarding-discoveries';
import { OnboardingSteps } from './onboarding-steps';

const stageOfJob: Record<string, 0 | 1 | 2> = { 'brand.crawl': 0, 'brand.research': 1, 'brand.synthesize-dna': 2 };

const READY_PAUSE_MS = 1400;

const stageMessages = [
  { first: 'Reading your pages and picking out your colours.', later: 'Some sites take a little longer to open. Hang tight.', laterAfterSeconds: 30 },
  {
    first: 'Searching the web for what people say about you and who you compete with. This usually takes about a minute.',
    later: 'Still searching. Busy markets take a little longer.',
    laterAfterSeconds: 90,
  },
  { first: 'Turning everything into your Brand DNA.', later: 'Almost there. Putting on the finishing touches.', laterAfterSeconds: 45 },
];

function StageMessage({ stage }: { stage: OnboardingStage }) {
  const [late, setLate] = useState(false);
  const message = stageMessages[stage];

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setLate(true), message.laterAfterSeconds * 1000);
    return () => clearTimeout(timer);
  }, [message]);

  const text = message ? (late ? message.later : message.first) : 'Taking you to your Brand DNA.';
  return (
    <p key={text} className="animate-rise text-sm text-muted">
      {text}
    </p>
  );
}

function BrandMark({ logoUrl, ready }: { logoUrl?: string; ready: boolean }) {
  return (
    <div className="relative">
      <div
        key={ready ? 'ready' : 'working'}
        className={cn(
          'flex size-20 items-center justify-center overflow-hidden rounded-card border border-border bg-surface',
          ready ? 'animate-pop' : 'animate-breathe',
        )}
      >
        {logoUrl ? (
          <img key={logoUrl} src={logoUrl} alt="" className="size-14 animate-pop object-contain" />
        ) : (
          <img src="/brand/logo/lumo-mark.svg" alt="" width={48} height={48} className="size-12" />
        )}
      </div>
      {ready && (
        <span className="absolute -bottom-2 -right-2 flex size-8 animate-pop items-center justify-center rounded-full bg-violet text-violet-foreground [animation-delay:200ms]">
          <span className="absolute inset-0 animate-glow rounded-full [animation-delay:200ms]" />
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      )}
    </div>
  );
}

export function OnboardingProgress({ brandId, discoveries }: { brandId: string; discoveries: OnboardingDiscoveries }) {
  const router = useRouter();
  const [reached, setReached] = useState<OnboardingStage>(0);
  const stage = Math.max(reached, discoveries.stage) as OnboardingStage;
  const ready = stage === 3;

  useJobEvents(brandId, (event) => {
    const index = stageOfJob[event.type];
    if (index === undefined) return;
    if (event.status === 'failed') {
      router.push(`/brands/${brandId}/dna`);
      return;
    }
    if (event.status === 'succeeded') {
      setReached((previous) => Math.max(previous, index + 1) as OnboardingStage);
      if (index < 2) router.refresh();
      return;
    }
    if (event.status === 'running') setReached((previous) => Math.max(previous, index) as OnboardingStage);
  }, () => router.refresh());

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => router.push(`/brands/${brandId}/dna?welcome=1`), READY_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [ready, brandId, router]);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-8 py-8">
      <header className="flex flex-col items-center gap-5 text-center">
        <BrandMark logoUrl={discoveries.logoUrl} ready={ready} />
        <div aria-live="polite" className="flex flex-col gap-1.5">
          <h1 key={String(ready)} className="animate-rise text-2xl font-bold tracking-tight">
            {ready ? 'Your brand is ready' : `Getting to know ${discoveries.host}`}
          </h1>
          <StageMessage key={stage} stage={stage} />
        </div>
      </header>
      <Card className="p-5">
        <OnboardingSteps current={stage} />
      </Card>
      <DiscoveryFeed discoveries={discoveries} working={!ready} />
    </section>
  );
}
