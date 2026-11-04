'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { SidebarNav, type BrandOption } from './sidebar-nav';
import { UserMenu } from './user-menu';

const desktopQuery = '(min-width: 768px)';

function subscribeToDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => true,
  );
}

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
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const sheetOpen = open && !isDesktop;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (sheetOpen) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = sheetOpen;
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  return (
    <div className="min-h-dvh md:flex">
      <header inert={sheetOpen} className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={sheetOpen}
          aria-controls="app-sidebar"
          className="flex size-10 items-center justify-center rounded-control hover:bg-elevated"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <span className="text-lg font-bold tracking-tight">OpenLumo</span>
      </header>
      {sheetOpen && <div className="fixed inset-0 z-30 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        id="app-sidebar"
        inert={!isDesktop && !open}
        role={sheetOpen ? 'dialog' : undefined}
        aria-modal={sheetOpen ? true : undefined}
        aria-label="Main menu"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-5">
          <span className="text-lg font-bold tracking-tight">OpenLumo</span>
          <button
            ref={closeRef}
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
      <main inert={sheetOpen} className="min-w-0 flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
