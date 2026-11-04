import type { ComponentType, ReactNode } from 'react';
import { FileText, Globe, Palette, Users } from 'lucide-react';
import type { OnboardingDiscoveries } from './onboarding-discoveries';

const SHOWN_CHIPS = 6;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function Discovery({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string }>; title: string; children?: ReactNode }) {
  return (
    <li className="flex animate-rise gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated text-lilac">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-2 pt-1.5">
        <p className="text-sm font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Chips({ items, label }: { items: string[]; label: string }) {
  const unique = [...new Set(items)];
  const hidden = unique.length - SHOWN_CHIPS;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {unique.slice(0, SHOWN_CHIPS).map((item, index) => (
        <li
          key={item}
          style={{ animationDelay: `${index * 60}ms` }}
          className="max-w-56 animate-rise truncate rounded-full border border-border px-2.5 py-0.5 text-xs text-muted"
        >
          {item}
        </li>
      ))}
      {hidden > 0 && <li className="px-1 py-0.5 text-xs text-muted">+{hidden} more</li>}
    </ul>
  );
}

function Looking() {
  return (
    <li aria-hidden className="flex gap-3">
      <span className="shimmer animate-shimmer size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2 pt-1.5">
        <span className="shimmer animate-shimmer h-3.5 w-40 rounded-full" />
        <span className="shimmer animate-shimmer h-3 w-56 max-w-full rounded-full" />
      </div>
    </li>
  );
}

export function DiscoveryFeed({ discoveries, working }: { discoveries: OnboardingDiscoveries; working: boolean }) {
  const { pages, palette, research } = discoveries;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-muted">{working ? 'What Lumo has found so far' : 'What Lumo found'}</h2>
      <ul className="flex flex-col gap-5">
        {pages.length > 0 && (
          <Discovery icon={FileText} title={`Read ${plural(pages.length, 'page', 'pages')}`}>
            <Chips items={pages} label="Pages" />
          </Discovery>
        )}
        {palette.length > 0 && (
          <Discovery icon={Palette} title={`Picked up ${plural(palette.length, 'colour', 'colours')}`}>
            <ul aria-label="Colours" className="flex flex-wrap gap-2">
              {palette.map((colour, index) => (
                <li
                  key={colour}
                  title={colour}
                  style={{ backgroundColor: colour, animationDelay: `${index * 80}ms` }}
                  className="size-7 animate-pop rounded-full border border-border"
                >
                  <span className="sr-only">{colour}</span>
                </li>
              ))}
            </ul>
          </Discovery>
        )}
        {research && !research.finished && (
          <Discovery icon={Globe} title="Web research didn't finish, so Lumo is working from your site" />
        )}
        {research?.finished && (
          <Discovery
            icon={Globe}
            title={research.sourceCount > 0 ? `Checked ${plural(research.sourceCount, 'source', 'sources')} on the web` : 'Searched the web'}
          >
            {research.sources.length > 0 && <Chips items={research.sources} label="Sources" />}
          </Discovery>
        )}
        {research?.finished && (
          <Discovery
            icon={Users}
            title={
              research.competitors.length > 0
                ? `Found ${plural(research.competitors.length, 'competitor', 'competitors')}`
                : 'No clear competitors yet. You can add them on Brand DNA'
            }
          >
            {research.competitors.length > 0 && <Chips items={research.competitors} label="Competitors" />}
          </Discovery>
        )}
        {working && <Looking />}
      </ul>
    </section>
  );
}
