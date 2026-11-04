import { getAuthHandler } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => getAuthHandler().GET(request);
export const POST = (request: Request) => getAuthHandler().POST(request);
