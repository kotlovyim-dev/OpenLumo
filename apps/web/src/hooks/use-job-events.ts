'use client';

import { useEffect, useRef } from 'react';
import type { JobEvent } from '@openlumo/core';

export function useJobEvents(brandId: string, onEvent: (event: JobEvent) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    const source = new EventSource(`/api/brands/${brandId}/events`);
    source.onmessage = (message) => handler.current(JSON.parse(message.data) as JobEvent);
    return () => source.close();
  }, [brandId]);
}
