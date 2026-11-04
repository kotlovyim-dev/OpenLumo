'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { toLocalInput, useBrowserValue } from '@/components/local-time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BoardCard, ItemStatus } from '../board/board-service';
import { formatLabels } from '../board/item-card';
import { channelDotClasses, channelLabels } from '../strategy/channel-style';

const statusLabels: Partial<Record<ItemStatus, string>> = {
  suggested: 'Suggested',
  in_review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
};

export function CalendarCard({
  card,
  href,
  time,
  canEdit,
  pending,
  onSchedule,
}: {
  card: BoardCard & { scheduledAt: string };
  href: string;
  time: string;
  canEdit: boolean;
  pending: boolean;
  onSchedule: (itemId: string, scheduledAt: string) => void;
}) {
  const localValue = useBrowserValue(() => toLocalInput(card.scheduledAt), '');
  const inputId = `reschedule-${card.id}`;

  function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(String(new FormData(event.currentTarget).get('scheduledAt')));
    if (!Number.isNaN(date.getTime())) onSchedule(card.id, date.toISOString());
  }

  return (
    <article
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', card.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={`flex flex-col gap-1 rounded-control border border-border bg-surface p-2 text-xs ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-1.5 text-muted">
        <span className={`size-2 shrink-0 rounded-full ${channelDotClasses[card.channel]}`} aria-hidden="true" />
        <time dateTime={card.scheduledAt} className="tabular-nums">
          {time}
        </time>
        <span className="truncate">
          {channelLabels[card.channel]} · {formatLabels[card.format]}
        </span>
      </div>
      <Link href={href} scroll={false} className="line-clamp-2 font-semibold leading-snug hover:text-lilac">
        {card.title ?? 'Drafting…'}
      </Link>
      <span className={card.status === 'approved' || card.status === 'scheduled' ? 'text-lilac' : 'text-muted'}>
        {statusLabels[card.status]}
      </span>
      {canEdit && (
        <details className="group">
          <summary className="cursor-pointer text-muted hover:text-foreground">Reschedule</summary>
          <form onSubmit={reschedule} className="mt-2 flex flex-col gap-2">
            <label htmlFor={inputId} className="sr-only">
              New date and time
            </label>
            <Input
              key={localValue}
              id={inputId}
              name="scheduledAt"
              type="datetime-local"
              required
              defaultValue={localValue}
              className="h-8 px-2 text-xs"
            />
            <Button type="submit" variant="outline" className="h-8 px-2 text-xs" disabled={pending}>
              Move
            </Button>
          </form>
        </details>
      )}
    </article>
  );
}
