import type { JobEvent } from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { findBrandAccess } from './brand-access';

const heartbeatMs = 25000;

export type EventStreamContext = {
  db: Database;
  user: { id: string };
  subscribe: (brandId: string, listener: (event: JobEvent) => void) => () => void;
};

export async function openBrandEventStream(
  context: EventStreamContext,
  brandId: string,
  signal: AbortSignal,
): Promise<Response> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'viewer'))) {
    return new Response(null, { status: 404 });
  }
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (signal.aborted) {
        controller.close();
        return;
      }
      const unsubscribe = context.subscribe(brandId, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': heartbeat\n\n')), heartbeatMs);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      signal.addEventListener('abort', () => {
        cleanup();
        controller.close();
      });
      controller.enqueue(encoder.encode(': connected\n\n'));
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
