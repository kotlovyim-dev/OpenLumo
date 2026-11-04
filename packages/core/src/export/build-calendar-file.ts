import { createEvents } from 'ics';

const EVENT_MINUTES = 30;

export type CalendarItem = { id: string; title: string; scheduledAt: Date; description: string };

export function buildCalendarFile(items: CalendarItem[]): string {
  const { error, value } = createEvents(
    items.map((item) => ({
      uid: `${item.id}@openlumo`,
      title: item.title,
      description: item.description,
      start: item.scheduledAt.getTime(),
      startInputType: 'utc' as const,
      startOutputType: 'utc' as const,
      end: item.scheduledAt.getTime() + EVENT_MINUTES * 60_000,
      endInputType: 'utc' as const,
      endOutputType: 'utc' as const,
    })),
  );
  if (error || !value) throw error ?? new Error('Calendar file was empty');
  return value;
}
