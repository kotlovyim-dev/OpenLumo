'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { ItemFormat } from '@openlumo/core';
import { LocalTime } from '@/components/local-time';
import { Button } from '@/components/ui/button';
import { channelDotClasses, channelLabels } from '../strategy/channel-style';
import { regenerateItem } from './actions';
import type { BoardCard } from './board-service';

export const formatLabels: Record<ItemFormat, string> = {
  social_post: 'Social post',
  carousel: 'Carousel',
  static_ad: 'Static ad',
  email: 'Email',
  blog_post: 'Blog post',
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatCost(costUsd: number) {
  return usd.format(costUsd);
}

export function ItemCard({
  card,
  href,
  liveStep,
  canEdit,
}: {
  card: BoardCard;
  href: string;
  liveStep?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const { run } = card;
  const active = run?.status === 'queued' || run?.status === 'running';
  const step = liveStep ?? (active ? (run?.step ?? 'Waiting to start') : null);
  const failedCode = !liveStep && run?.status === 'failed' ? (run.errorCode ?? 'failed') : null;

  async function retry() {
    setRetrying(true);
    setRetryError(false);
    try {
      const result = await regenerateItem(card.id, 'all');
      if (!result.ok) setRetryError(true);
      router.refresh();
    } catch {
      setRetryError(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <article className="relative flex flex-col gap-3 rounded-card border border-border bg-surface p-3 transition-colors focus-within:border-lilac hover:border-lilac/60">
      {card.imageAssetId && (
        <img
          src={`/api/assets/${card.imageAssetId}`}
          alt=""
          className="aspect-square w-full rounded-control bg-elevated object-cover"
        />
      )}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className={`size-2 rounded-full ${channelDotClasses[card.channel]}`} aria-hidden="true" />
        <span>{channelLabels[card.channel]}</span>
        <span aria-hidden="true">·</span>
        <span>{formatLabels[card.format]}</span>
      </div>
      <h3 className="line-clamp-3 text-sm font-semibold leading-snug">
        <Link href={href} scroll={false} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
          {card.title ?? 'Drafting…'}
        </Link>
      </h3>
      {card.scheduledAt && (
        <p className="text-xs text-muted">
          <LocalTime value={card.scheduledAt} />
        </p>
      )}
      <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {step && <span className="text-lilac">{step}</span>}
        {failedCode && (
          <span className="flex items-center gap-2">
            <span className="rounded-control bg-danger/15 px-2 py-0.5 font-mono text-danger">{failedCode}</span>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={retry}
                disabled={retrying}
                className="relative z-10 h-7 px-2 text-xs"
              >
                <RotateCw className="size-3" aria-hidden="true" />
                Retry
              </Button>
            )}
          </span>
        )}
        {run && <span className="ml-auto tabular-nums text-muted">{formatCost(run.costUsd)}</span>}
      </div>
      {retryError && (
        <p role="alert" className="text-xs text-danger">
          Could not retry. Try again.
        </p>
      )}
    </article>
  );
}
