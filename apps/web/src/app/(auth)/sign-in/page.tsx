import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectIfSignedIn } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Sign in' };

export default async function Page() {
  await redirectIfSignedIn();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <p className="text-xl font-bold tracking-tight">OpenLumo</p>
      <AuthForm mode="sign-in" />
    </main>
  );
}
