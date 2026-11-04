'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { SidebarNav, type BrandOption } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function AppShell({
  brands,
  user,
  children,
}: {
  brands: BrandOption[];
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="min-h-dvh md:flex">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-control hover:bg-elevated"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="text-lg font-bold tracking-tight">OpenLumo</span>
      </header>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-5">
          <span className="text-lg font-bold tracking-tight">OpenLumo</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex size-9 items-center justify-center rounded-control hover:bg-elevated md:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <SidebarNav brands={brands} />
        <UserMenu name={user.name} email={user.email} />
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
