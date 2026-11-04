'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LocalTime } from '@/components/local-time';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useJobEvents } from '@/hooks/use-job-events';
import { refreshResearchAction } from './actions';

export type ResearchSummary = {
  status: 'succeeded' | 'failed';
  sources: { url: string; title: string }[];
  researchedAt: string | null;
};

const genericError = 'Something went wrong. Try again.';

function isWebAddress(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function ResearchPanel({
  brandId,
  research,
  canRefresh,
}: {
  brandId: string;
  research: ResearchSummary | null;
  canRefresh: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sources = research?.sources.filter((source) => isWebAddress(source.url)) ?? [];

  useJobEvents(brandId, (event) => {
    if (event.type !== 'brand.research') return;
    if (event.status === 'succeeded' || event.status === 'failed') {
      setStep(null);
      router.refresh();
      return;
    }
    setStep(event.step ?? 'Researching your market');
  });

  async function refresh() {
    setError(null);
    setStep('Researching your market');
    try {
      const result = await refreshResearchAction(brandId);
      if (!result.ok) {
        setStep(null);
        setError(genericError);
      }
    } catch {
      setStep(null);
      setError(genericError);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Web research</h2>
        {research?.researchedAt ? (
          <p className="text-sm text-muted">
            Researched on <LocalTime value={research.researchedAt} /> · {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </p>
        ) : (
          <p className="text-sm text-muted">Lumo has not researched this brand on the web yet.</p>
        )}
      </div>
      {research?.status === 'failed' && (
        <p role="alert" className="text-sm text-danger">
          Web research didn&apos;t finish. Lumo used your site only. Try refreshing the research.
        </p>
      )}
      {sources.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">Show sources</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
                  {source.title || source.url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {canRefresh && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" onClick={refresh} disabled={step !== null}>
              {step ? 'Researching...' : 'Refresh research'}
            </Button>
            {step && <p className="text-sm text-muted">{step}</p>}
          </div>
          <p className="text-xs text-muted">Replaces competitors, features and audience with fresh findings.</p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
