import type { Metadata } from 'next';
import { Wordmark } from '@/components/wordmark';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectIfSignedIn } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Create account' };

export default async function Page() {
  await redirectIfSignedIn();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Wordmark className="h-10" />
      <AuthForm mode="sign-up" />
    </main>
  );
}
