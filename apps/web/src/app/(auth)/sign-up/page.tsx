import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <p className="text-xl font-bold tracking-tight">OpenLumo</p>
      <AuthForm mode="sign-up" />
    </main>
  );
}
