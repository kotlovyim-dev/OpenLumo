'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export function useBrowserValue<T>(compute: () => T, serverValue: T) {
  return useSyncExternalStore(subscribe, compute, () => serverValue);
}

export function LocalTime({ value }: { value: string }) {
  const text = useBrowserValue(
    () => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    value.slice(0, 16).replace('T', ' ') + ' UTC',
  );
  return <time dateTime={value}>{text}</time>;
}
