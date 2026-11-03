import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import type { Database } from '@openlumo/db';
import type { JobName } from './job-names';

const channel = 'job_events';

export type JobEvent = {
  runId: string;
  brandId: string;
  itemId?: string;
  type: JobName;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  step?: string;
  errorCode?: string;
};

export async function publishJobEvent(db: Database, event: JobEvent): Promise<void> {
  await db.execute(sql`select pg_notify(${channel}, ${JSON.stringify(event)})`);
}

export async function listenToJobEvents(
  databaseUrl: string,
  onEvent: (event: JobEvent) => void,
): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  client.on('error', (error) => {
    console.error('job event listener connection lost', error);
  });
  client.on('notification', (message) => {
    if (!message.payload) return;
    try {
      onEvent(JSON.parse(message.payload) as JobEvent);
    } catch {
      return;
    }
  });
  try {
    await client.query(`LISTEN ${channel}`);
  } catch (error) {
    await client.end();
    throw error;
  }
  return () => client.end();
}
