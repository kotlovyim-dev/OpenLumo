import type { JobEvent } from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { findBrandAccess } from './brand-access';

const heartbeatMs = 25000;

export type EventStreamContext = {
  db: Database;
  user: { id: string };
  subscribe: (brandId: string, listener: (event: JobEvent) => void, onReconnect?: () => void) => () => void;
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
  let closed = false;
  let release = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (signal.aborted) {
        controller.close();
        return;
      }
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const unsubscribe = context.subscribe(
        brandId,
        (event) => send(`data: ${JSON.stringify(event)}\n\n`),
        () => {
          if (closed) return;
          release();
          controller.close();
        },
      );
      const heartbeat = setInterval(() => send(': heartbeat\n\n'), heartbeatMs);
      release = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };
      signal.addEventListener('abort', () => {
        if (closed) return;
        release();
        controller.close();
      });
      send(': connected\n\n');
    },
    cancel() {
      release();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
