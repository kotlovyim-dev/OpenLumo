'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useJobEvents } from './use-job-events';

export function useLiveSteps(brandId: string) {
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

  return liveSteps;
}
