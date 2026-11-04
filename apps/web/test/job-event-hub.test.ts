import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobEvent } from '@openlumo/core';
import { createJobEventHub } from '../src/lib/job-event-hub';

const event = (brandId: string): JobEvent => ({ runId: 'r', brandId, type: 'brand.crawl', status: 'running' });

type Connection = { emit: (event: JobEvent) => void; close: () => void; stopped: boolean };

describe('job event hub', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeListen(failures = 0) {
    const connections: Connection[] = [];
    let remainingFailures = failures;
    const listen = vi.fn(async (onEvent: (event: JobEvent) => void, options: { onClose: () => void }) => {
      if (remainingFailures-- > 0) throw new Error('down');
      const connection: Connection = { emit: onEvent, close: options.onClose, stopped: false };
      connections.push(connection);
      return async () => {
        connection.stopped = true;
      };
    });
    return { listen, connections };
  }

  it('starts lazily with one subscription and fans out per brand', async () => {
    const { listen, connections } = fakeListen();
    const hub = createJobEventHub(listen);
    expect(listen).not.toHaveBeenCalled();

    const a: JobEvent[] = [];
    const b: JobEvent[] = [];
    const stopA = hub.subscribe('a', (received) => a.push(received));
    hub.subscribe('b', (received) => b.push(received));
    await vi.advanceTimersByTimeAsync(0);
    expect(listen).toHaveBeenCalledTimes(1);

    connections[0]!.emit(event('a'));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);

    stopA();
    connections[0]!.emit(event('a'));
    expect(a).toHaveLength(1);
  });

  it('reconnects with doubling backoff capped at the maximum, and resets after success', async () => {
    const { listen, connections } = fakeListen(3);
    const hub = createJobEventHub(listen, { initialDelayMs: 1000, maxDelayMs: 3000 });
    hub.subscribe('a', () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(listen).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(listen).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(listen).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(2999);
    expect(listen).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(listen).toHaveBeenCalledTimes(4);

    connections[0]!.close();
    await vi.advanceTimersByTimeAsync(999);
    expect(listen).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(listen).toHaveBeenCalledTimes(5);
  });

  it('stops listening when the last subscriber leaves and does not reconnect', async () => {
    const { listen, connections } = fakeListen();
    const hub = createJobEventHub(listen);
    const stop = hub.subscribe('a', () => {});
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(connections[0]!.stopped).toBe(true);
    connections[0]!.close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(listen).toHaveBeenCalledTimes(1);
  });
});
