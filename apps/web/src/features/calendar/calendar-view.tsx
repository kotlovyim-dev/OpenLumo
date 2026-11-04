'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBrowserValue } from '@/components/local-time';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { scheduleItem } from '../board/actions';
import type { BoardCard } from '../board/board-service';
import { ExportButton } from '../export/export-button';
import type { CalendarView as View } from './calendar-range';
import { CalendarCard } from './calendar-card';
import { moveToDay } from './move-to-day';

type ScheduledCard = BoardCard & { scheduledAt: string };

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const errorMessages: Record<string, string> = {
  invalid_input: 'Pick a valid date and time.',
  invalid_transition: 'This item can no longer be rescheduled.',
  conflict: 'This item changed meanwhile. Try again.',
};

function dayKeyFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function CalendarView({
  brandId,
  view,
  date,
  days,
  month,
  previous,
  next,
  today,
  cards,
  canEdit,
}: {
  brandId: string;
  view: View;
  date: string;
  days: string[];
  month: string;
  previous: string;
  next: string;
  today: string;
  cards: ScheduledCard[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const timeZone = useBrowserValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC');
  const locale = useBrowserValue(() => navigator.language, 'en-US');
  const localToday = useBrowserValue(() => dayKeyFormatter(timeZone).format(new Date()), today);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const { byDay, times } = useMemo(() => {
    const dayKey = dayKeyFormatter(timeZone);
    const timeFormat = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' });
    const grouped = new Map<string, ScheduledCard[]>();
    const timeById = new Map<string, string>();
    for (const card of cards) {
      const at = new Date(card.scheduledAt);
      const key = dayKey.format(at);
      grouped.set(key, [...(grouped.get(key) ?? []), card]);
      timeById.set(card.id, timeFormat.format(at));
    }
    return { byDay: grouped, times: timeById };
  }, [cards, timeZone, locale]);

  const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...options });

  const query = (nextView: View, nextDate: string) => `/brands/${brandId}/calendar?view=${nextView}&date=${nextDate}`;
  const current = query(view, date);
  const visibleCards = days.flatMap((day) => byDay.get(day) ?? []);
  const weekExportIds = visibleCards
    .filter((card) => card.status === 'approved' || card.status === 'scheduled')
    .map((card) => card.id);
  const title =
    view === 'month'
      ? dayLabel(`${month}-01`, { month: 'long', year: 'numeric' })
      : `${dayLabel(days[0]!, { day: 'numeric', month: 'short' })} – ${dayLabel(days.at(-1)!, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  async function schedule(itemId: string, scheduledAt: string) {
    setPending(true);
    setMessage(null);
    try {
      const result = await scheduleItem(itemId, scheduledAt);
      if (result.ok) router.refresh();
      else setMessage(errorMessages[result.error] ?? 'Something went wrong. Try again.');
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  function drop(event: DragEvent, day: string) {
    event.preventDefault();
    setDropDay(null);
    const card = cards.find((entry) => entry.id === event.dataTransfer.getData('text/plain'));
    if (!card || dayKeyFormatter(timeZone).format(new Date(card.scheduledAt)) === day) return;
    void schedule(card.id, moveToDay(card.scheduledAt, day));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Calendar view" className="flex rounded-control border border-border p-0.5">
            {(['month', 'week'] as const).map((option) => (
              <Link
                key={option}
                href={query(option, date)}
                aria-current={view === option ? 'page' : undefined}
                className={cn(
                  'rounded-[6px] px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground',
                  view === option && 'bg-elevated text-foreground',
                )}
              >
                {option === 'month' ? 'Month' : 'Week'}
              </Link>
            ))}
          </nav>
          <nav aria-label="Calendar dates" className="flex items-center gap-1">
            <Link href={query(view, previous)} aria-label={`Previous ${view}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link href={query(view, localToday)} className={buttonVariants({ variant: 'outline' })}>
              Today
            </Link>
            <Link href={query(view, next)} aria-label={`Next ${view}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </div>

      {view === 'week' && canEdit && (
        <ExportButton brandId={brandId} itemIds={weekExportIds} label={`Export week (${weekExportIds.length})`} />
      )}

      <p role="status" aria-live="polite" className="text-sm text-danger empty:hidden">
        {message}
      </p>

      {visibleCards.length === 0 && <p className="text-sm text-muted">Nothing is scheduled in this {view}.</p>}

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-7">
        {weekdays.map((weekday) => (
          <div key={weekday} className="hidden bg-surface px-2 py-2 text-xs font-semibold text-muted md:block">
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const dayCards = byDay.get(day) ?? [];
          const outside = view === 'month' && !day.startsWith(month);
          return (
            <section
              key={day}
              aria-label={dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}
              onDragOver={
                canEdit
                  ? (event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropDay(day);
                    }
                  : undefined
              }
              onDragLeave={() => setDropDay((currentDay) => (currentDay === day ? null : currentDay))}
              onDrop={canEdit ? (event) => drop(event, day) : undefined}
              className={cn(
                'flex flex-col gap-2 bg-background p-2',
                view === 'month' ? 'md:min-h-32' : 'md:min-h-80',
                outside && 'bg-surface/60',
                view === 'month' && dayCards.length === 0 && 'max-md:hidden',
                dropDay === day && 'outline-2 -outline-offset-2 outline-lilac',
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-2 text-xs font-medium',
                  outside ? 'text-muted/60' : 'text-muted',
                  day === localToday && 'text-lilac',
                )}
              >
                <span className="md:hidden">{dayLabel(day, { weekday: 'short' })}</span>
                <span
                  className={cn(
                    'tabular-nums',
                    day === localToday && 'rounded-full bg-violet px-1.5 py-0.5 font-semibold text-violet-foreground',
                  )}
                >
                  {Number(day.slice(8))}
                </span>
              </span>
              {dayCards.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {dayCards.map((card) => (
                    <li key={card.id}>
                      <CalendarCard
                        card={card}
                        href={`${current}&item=${card.id}`}
                        time={times.get(card.id) ?? ''}
                        canEdit={canEdit}
                        pending={pending}
                        onSchedule={(itemId, scheduledAt) => void schedule(itemId, scheduledAt)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {canEdit && (
        <p className="text-xs text-muted">Drag a card onto another day to move it, or use Reschedule on the card.</p>
      )}
    </div>
  );
}
