import { DAY_MS } from '@openlumo/core';

export type CalendarView = 'month' | 'week';

export type CalendarRange = {
  view: CalendarView;
  date: string;
  days: string[];
  month: string;
  previous: string;
  next: string;
  from: Date;
  to: Date;
};

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromKey(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function mondayOf(date: Date) {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromKey(value);
  return !Number.isNaN(date.getTime()) && toKey(date) === value;
}

export function todayKey(now = new Date()) {
  return toKey(now);
}

export function parseCalendarParams(params: { view?: unknown; date?: unknown }, today: string) {
  return {
    view: params.view === 'week' ? 'week' : 'month',
    date: isDateKey(params.date) ? params.date : today,
  } satisfies { view: CalendarView; date: string };
}

export function calendarRange(view: CalendarView, date: string): CalendarRange {
  const anchor = fromKey(date);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const start = view === 'week' ? mondayOf(anchor) : mondayOf(new Date(Date.UTC(year, month, 1)));
  const end = view === 'week' ? addDays(start, 7) : addDays(mondayOf(new Date(Date.UTC(year, month + 1, 0))), 7);
  const days = Array.from({ length: Math.round((end.getTime() - start.getTime()) / DAY_MS) }, (_, index) =>
    toKey(addDays(start, index)),
  );
  return {
    view,
    date,
    days,
    month: date.slice(0, 7),
    previous: toKey(view === 'week' ? addDays(start, -7) : new Date(Date.UTC(year, month - 1, 1))),
    next: toKey(view === 'week' ? end : new Date(Date.UTC(year, month + 1, 1))),
    from: addDays(start, -1),
    to: addDays(end, 1),
  };
}
