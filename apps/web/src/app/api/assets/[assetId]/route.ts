import { assetResponse } from '@/features/assets/asset-response';
import { getAuth } from '@/lib/auth';
import { getRuntime } from '@/lib/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const session = await getAuth().api.getSession({ headers: request.headers });
  const { db, storage } = getRuntime();
  return assetResponse({ db, storage }, session?.user.id ?? null, assetId);
}
