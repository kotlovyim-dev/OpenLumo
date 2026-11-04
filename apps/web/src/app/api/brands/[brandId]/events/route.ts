import { openBrandEventStream } from '@/features/brands/events-stream';
import { getJobEventHub } from '@/lib/job-event-hub';
import { getServerContext } from '@/lib/server-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { db, config, user } = await getServerContext();
  const hub = getJobEventHub(config.databaseUrl);
  return openBrandEventStream({ db, user, subscribe: hub.subscribe }, brandId, request.signal);
}
