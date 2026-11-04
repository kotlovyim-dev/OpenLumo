'use client';

import { useLiveSteps } from '@/hooks/use-live-steps';
import type { BoardCard } from '../board/board-service';
import { ItemCard } from '../board/item-card';

export function StudioItems({ brandId, cards, canEdit }: { brandId: string; cards: BoardCard[]; canEdit: boolean }) {
  const liveSteps = useLiveSteps(brandId);

  return (
    <section aria-labelledby="studio-items-heading" className="flex flex-col gap-4">
      <h2 id="studio-items-heading" className="text-lg font-semibold tracking-tight">
        Made in the studio
      </h2>
      {cards.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Pick a channel and format above, and Lumo drafts the variants here.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <li key={card.id}>
              <ItemCard
                card={card}
                href={`/brands/${brandId}/studio?item=${card.id}`}
                liveStep={liveSteps[card.id]}
                canEdit={canEdit}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
