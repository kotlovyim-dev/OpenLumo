'use client';

import { useEffect, useRef } from 'react';
import type { JobEvent } from '@openlumo/core';

export function useJobEvents(brandId: string, onEvent: (event: JobEvent) => void, onOpen?: () => void) {
  const handler = useRef(onEvent);
  const opened = useRef(onOpen);
  useEffect(() => {
    handler.current = onEvent;
    opened.current = onOpen;
  });

  useEffect(() => {
    const source = new EventSource(`/api/brands/${brandId}/events`);
    source.onopen = () => opened.current?.();
    source.onmessage = (message) => handler.current(JSON.parse(message.data) as JobEvent);
    return () => source.close();
  }, [brandId]);
}
