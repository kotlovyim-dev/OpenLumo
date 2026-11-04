import { listenToJobEvents, type JobEvent } from '@openlumo/core';

type JobEventListener = (event: JobEvent) => void;

type Listen = (onEvent: JobEventListener, options: { onClose: () => void }) => Promise<() => Promise<void>>;

export type JobEventHub = {
  subscribe: (brandId: string, listener: JobEventListener) => () => void;
};

export function createJobEventHub(listen: Listen, { initialDelayMs = 1000, maxDelayMs = 30000 } = {}): JobEventHub {
  const listeners = new Map<string, Set<JobEventListener>>();
  let generation = 0;
  let delayMs = initialDelayMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unlisten: (() => Promise<void>) | undefined;

  function dispatch(event: JobEvent) {
    for (const listener of listeners.get(event.brandId) ?? []) listener(event);
  }

  function retry(attempt: number) {
    unlisten = undefined;
    if (attempt !== generation) return;
    timer = setTimeout(() => void connect(attempt), delayMs);
    delayMs = Math.min(delayMs * 2, maxDelayMs);
  }

  async function connect(attempt: number) {
    try {
      const stop = await listen(dispatch, { onClose: () => retry(attempt) });
      if (attempt !== generation) {
        await stop();
        return;
      }
      unlisten = stop;
      delayMs = initialDelayMs;
    } catch {
      retry(attempt);
    }
  }

  function stop() {
    generation++;
    clearTimeout(timer);
    delayMs = initialDelayMs;
    const stopListening = unlisten;
    unlisten = undefined;
    void stopListening?.();
  }

  return {
    subscribe(brandId, listener) {
      const wasIdle = listeners.size === 0;
      const brandListeners = listeners.get(brandId) ?? new Set<JobEventListener>();
      brandListeners.add(listener);
      listeners.set(brandId, brandListeners);
      if (wasIdle) void connect(++generation);
      return () => {
        brandListeners.delete(listener);
        if (brandListeners.size === 0) listeners.delete(brandId);
        if (listeners.size === 0) stop();
      };
    },
  };
}

const cache = globalThis as typeof globalThis & { openlumoJobEventHub?: JobEventHub };

export function getJobEventHub(databaseUrl: string): JobEventHub {
  cache.openlumoJobEventHub ??= createJobEventHub((onEvent, options) =>
    listenToJobEvents(databaseUrl, onEvent, options),
  );
  return cache.openlumoJobEventHub;
}
