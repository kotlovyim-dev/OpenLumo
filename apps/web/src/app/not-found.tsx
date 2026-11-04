import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        spot="not-found"
        title="Page not found"
        description="Lumo looked everywhere, but this page doesn't exist or you don't have access to it."
        action={
          <Link href="/" className={buttonVariants()}>
            Back to OpenLumo
          </Link>
        }
      />
    </main>
  );
}
