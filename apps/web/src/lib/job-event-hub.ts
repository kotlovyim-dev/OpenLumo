import { listenToJobEvents, type JobEvent } from '@openlumo/core';

type JobEventListener = (event: JobEvent) => void;

type Listen = (onEvent: JobEventListener, options: { onClose: () => void }) => Promise<() => Promise<void>>;

export type JobEventHub = {
  subscribe: (brandId: string, listener: JobEventListener, onReconnect?: () => void) => () => void;
};

type Subscriber = { listener: JobEventListener; onReconnect?: () => void };

export function createJobEventHub(listen: Listen, { initialDelayMs = 1000, maxDelayMs = 30000 } = {}): JobEventHub {
  const subscribers = new Map<string, Set<Subscriber>>();
  let generation = 0;
  let delayMs = initialDelayMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unlisten: (() => Promise<void>) | undefined;
  let connectionLost = false;

  function dispatch(event: JobEvent) {
    for (const { listener } of subscribers.get(event.brandId) ?? []) listener(event);
  }

  function retry(attempt: number) {
    if (attempt !== generation) return;
    unlisten = undefined;
    connectionLost = true;
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
      if (connectionLost) {
        connectionLost = false;
        for (const brandSubscribers of [...subscribers.values()]) {
          for (const { onReconnect } of [...brandSubscribers]) onReconnect?.();
        }
      }
    } catch {
      retry(attempt);
    }
  }

  function stop() {
    generation++;
    clearTimeout(timer);
    delayMs = initialDelayMs;
    connectionLost = false;
    const stopListening = unlisten;
    unlisten = undefined;
    void stopListening?.();
  }

  return {
    subscribe(brandId, listener, onReconnect) {
      const wasIdle = subscribers.size === 0;
      const subscriber: Subscriber = { listener, onReconnect };
      const brandSubscribers = subscribers.get(brandId) ?? new Set<Subscriber>();
      brandSubscribers.add(subscriber);
      subscribers.set(brandId, brandSubscribers);
      if (wasIdle) void connect(++generation);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        brandSubscribers.delete(subscriber);
        if (brandSubscribers.size === 0) subscribers.delete(brandId);
        if (subscribers.size === 0) stop();
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
