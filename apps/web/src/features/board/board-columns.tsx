'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useJobEvents } from '@/hooks/use-job-events';
import type { BoardCard, ItemStatus } from './board-service';
import { ItemCard } from './item-card';

const columns: { status: ItemStatus; label: string }[] = [
  { status: 'suggested', label: 'Suggested' },
  { status: 'in_review', label: 'In review' },
  { status: 'approved', label: 'Approved' },
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'exported', label: 'Exported' },
];

export function BoardColumns({
  brandId,
  cards,
  canEdit,
  empty,
}: {
  brandId: string;
  cards: BoardCard[];
  canEdit: boolean;
  empty: ReactNode;
}) {
  const router = useRouter();
  const [liveSteps, setLiveSteps] = useState<Record<string, string>>({});

  useJobEvents(
    brandId,
    (event) => {
      if (event.status === 'succeeded' || event.status === 'failed') {
        const { itemId } = event;
        if (itemId) {
          setLiveSteps((current) => {
            const next = { ...current };
            delete next[itemId];
            return next;
          });
        }
        router.refresh();
        return;
      }
      if (event.itemId && event.step) {
        const { itemId, step } = event;
        setLiveSteps((current) => ({ ...current, [itemId]: step }));
      }
    },
    () => router.refresh(),
  );

  if (cards.length === 0) return empty;

  return (
    <div className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:scroll-px-0 md:px-0">
      {columns.map(({ status, label }) => {
        const columnCards = cards.filter((card) => card.status === status);
        return (
          <section
            key={status}
            aria-labelledby={`column-${status}`}
            className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-card bg-elevated/40 p-3"
          >
            <h2 id={`column-${status}`} className="flex items-center justify-between px-1 text-sm font-semibold">
              {label}
              <span className="text-xs font-medium text-muted">{columnCards.length}</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {columnCards.map((card) => (
                <li key={card.id}>
                  <ItemCard
                    card={card}
                    href={`/brands/${brandId}/board?item=${card.id}`}
                    liveStep={liveSteps[card.id]}
                    canEdit={canEdit}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
