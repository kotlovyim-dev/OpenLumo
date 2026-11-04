import { describe, expect, it } from 'vitest';
import { calendarRange, parseCalendarParams } from '../src/features/calendar/calendar-range';
import { moveToDay } from '../src/features/calendar/move-to-day';

describe('parseCalendarParams', () => {
  it('keeps a valid view and date', () => {
    expect(parseCalendarParams({ view: 'week', date: '2026-11-04' }, '2026-01-01')).toEqual({
      view: 'week',
      date: '2026-11-04',
    });
  });

  it.each([
    [{}, { view: 'month', date: '2026-01-01' }],
    [{ view: 'year', date: '2026-02-30' }, { view: 'month', date: '2026-01-01' }],
    [{ view: ['week'], date: 'tomorrow' }, { view: 'month', date: '2026-01-01' }],
    [{ view: 'week', date: '2026-1-5' }, { view: 'week', date: '2026-01-01' }],
    [{ view: 'week', date: '2026-13-40' }, { view: 'week', date: '2026-01-01' }],
  ])('falls back to month and today for %j', (params, expected) => {
    expect(parseCalendarParams(params, '2026-01-01')).toEqual(expected);
  });
});

describe('calendarRange', () => {
  it('covers whole Monday-first weeks around a month', () => {
    const range = calendarRange('month', '2026-11-18');
    expect(range.days[0]).toBe('2026-10-26');
    expect(range.days.at(-1)).toBe('2026-12-06');
    expect(range.days).toHaveLength(42);
    expect(range.month).toBe('2026-11');
    expect(range.previous).toBe('2026-10-01');
    expect(range.next).toBe('2026-12-01');
  });

  it('starts a week on Monday', () => {
    const range = calendarRange('week', '2026-11-08');
    expect(range.days).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(range.previous).toBe('2026-10-26');
    expect(range.next).toBe('2026-11-09');
  });

  it('queries a day beyond each edge so every time zone is covered', () => {
    const range = calendarRange('week', '2026-11-04');
    expect(range.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });
});

describe('moveToDay', () => {
  it('keeps the local time of day', () => {
    const original = new Date(2026, 10, 4, 9, 30);
    const moved = new Date(moveToDay(original.toISOString(), '2026-11-12'));
    expect([moved.getFullYear(), moved.getMonth(), moved.getDate()]).toEqual([2026, 10, 12]);
    expect([moved.getHours(), moved.getMinutes()]).toEqual([9, 30]);
  });
});
