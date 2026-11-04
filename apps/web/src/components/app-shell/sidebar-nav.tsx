'use client';

import { CalendarDays, Dna, LayoutGrid, Plus, Settings, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export type BrandOption = { id: string; name: string };

const brandLinks = [
  { label: 'Board', path: 'board', icon: LayoutGrid },
  { label: 'Studio', path: 'studio', icon: Sparkles },
  { label: 'Calendar', path: 'calendar', icon: CalendarDays },
  { label: 'Brand DNA', path: 'dna', icon: Dna },
  { label: 'Strategy', path: 'strategy', icon: Target },
];

export function SidebarNav({ brands }: { brands: BrandOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { brandId } = useParams<{ brandId?: string }>();
  const currentBrandId = brands.find((brand) => brand.id === brandId)?.id ?? brands[0]?.id;

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="brand-switcher" className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Brand
        </label>
        {brands.length > 0 ? (
          <select
            id="brand-switcher"
            value={currentBrandId}
            onChange={(event) => router.push(`/brands/${event.target.value}/board`)}
            className="h-10 w-full rounded-control border border-border bg-background px-3 text-sm"
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="px-1 text-sm text-muted">No brands yet</p>
        )}
        <Link
          href="/brands/new"
          className="flex h-9 items-center gap-2 rounded-control px-2 text-sm text-muted hover:bg-elevated hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          New brand
        </Link>
      </div>
      {currentBrandId && (
        <ul className="flex flex-col gap-1">
          {brandLinks.map(({ label, path, icon: Icon }) => {
            const href = `/brands/${currentBrandId}/${path}`;
            return (
              <li key={path}>
                <NavLink href={href} active={pathname.startsWith(href)} icon={<Icon className="size-4" aria-hidden="true" />}>
                  {label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="mt-auto flex flex-col gap-1">
        <li>
          <NavLink href="/settings" active={pathname.startsWith('/settings')} icon={<Settings className="size-4" aria-hidden="true" />}>
            Settings
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium text-muted hover:bg-elevated hover:text-foreground',
        active && 'bg-elevated text-foreground',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
