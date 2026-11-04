import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from './auth';
import { getBoss, getRuntime } from './runtime';

export type SessionUser = { id: string; name: string; email: string; role: string };

export async function getServerContext() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const { db, config, storage } = getRuntime();
  const { id, name, email, role } = session.user;
  const user: SessionUser = { id, name, email, role };
  return { db, boss: await getBoss(), config, storage, user };
}
