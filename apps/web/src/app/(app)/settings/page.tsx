import type { Metadata } from 'next';
import { getSetupStatus, getStoredKeyHint } from '@/features/settings/settings-service';
import { SettingsPanel } from '@/features/settings/settings-panel';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page() {
  const { db, config, user } = await getServerContext();
  const [status, keyHint] = await Promise.all([getSetupStatus({ db, config }), getStoredKeyHint({ db, config })]);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsPanel isAdmin={user.role === 'admin'} keyHint={keyHint} brain={status.brain} image={status.image} />
    </div>
  );
}
