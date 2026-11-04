import { redirect } from 'next/navigation';
import { getSetupStatus } from '@/features/settings/settings-service';
import { getServerContext } from '@/lib/server-context';

export default async function ReadyLayout({ children }: { children: React.ReactNode }) {
  const { db, config } = await getServerContext();
  if (!(await getSetupStatus({ db, config })).complete) redirect('/setup');
  return children;
}
