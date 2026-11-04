'use client';

import { Sparkles, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function WelcomeBanner({
  name,
  research,
  canEdit,
}: {
  name: string;
  research: { sources: number; competitors: number } | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  function dismiss() {
    setOpen(false);
    router.replace(pathname, { scroll: false });
  }

  const learned = research
    ? `Lumo read your site, checked ${plural(research.sources, 'source', 'sources')} on the web and found ${plural(research.competitors, 'competitor', 'competitors')}.`
    : 'Lumo learned this from your site.';

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative flex animate-rise gap-4 overflow-hidden rounded-card border border-violet/40 bg-elevated p-5"
    >
      <span className="flex size-10 shrink-0 animate-pop items-center justify-center rounded-full bg-violet text-violet-foreground [animation-delay:150ms]">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <div className="flex flex-1 flex-col gap-1 pr-8">
        <h2 id="welcome-title" className="text-lg font-semibold tracking-tight">
          Here&apos;s what Lumo learned about {name || 'your brand'}
        </h2>
        <p className="text-sm text-muted">
          {learned} {canEdit && 'Everything below is editable, so fix anything that looks off.'}
        </p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 size-8">
        <X className="size-4" aria-hidden />
      </Button>
    </section>
  );
}
