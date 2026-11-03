import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { listenToJobEvents, publishJobEvent, type JobEvent } from '../../src/jobs/job-events';

describe('job events', () => {
  let db: Database;
  let url: string;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, url, drop } = await createTestDatabase());
  });

  afterAll(async () => {
    await drop();
  });

  it('delivers published events to listeners until they unsubscribe', async () => {
    const received: JobEvent[] = [];
    const unlisten = await listenToJobEvents(url, (event) => received.push(event));
    const event: JobEvent = { runId: 'r1', brandId: 'b1', type: 'item.generate', status: 'running', step: 'copy' };

    await publishJobEvent(db, event);
    await expect.poll(() => received).toEqual([event]);

    await unlisten();
    await publishJobEvent(db, event);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received).toHaveLength(1);
  });
});
