'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 border-t border-border p-4">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-bold text-lilac"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted">{email}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        className="flex size-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-elevated hover:text-foreground"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
