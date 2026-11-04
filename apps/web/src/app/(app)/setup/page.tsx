import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { getSetupStatus } from '@/features/settings/settings-service';
import { SetupWizard } from '@/features/settings/setup-wizard';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Setup' };

export default async function Page() {
  const { db, config, user } = await getServerContext();
  const status = await getSetupStatus({ db, config });
  if (status.complete) redirect('/');
  if (user.role !== 'admin') {
    return (
      <EmptyState
        spot="setup-welcome"
        title="Waiting for the admin to finish setup"
        description="An admin needs to connect OpenRouter and choose models before you can start."
      />
    );
  }
  const initialStep = !status.hasKey ? 'welcome' : !status.brain ? 'brain' : 'image';
  return <SetupWizard initialStep={initialStep} brain={status.brain} image={status.image} />;
}
