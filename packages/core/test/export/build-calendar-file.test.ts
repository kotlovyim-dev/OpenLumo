import { describe, expect, it } from 'vitest';
import { buildCalendarFile } from '../../src/export/build-calendar-file';

describe('buildCalendarFile', () => {
  const items = [
    { id: 'a1', title: 'First', scheduledAt: new Date('2026-12-01T09:30:00Z'), description: 'One' },
    { id: 'b2', title: 'Second', scheduledAt: new Date('2026-12-02T18:00:00Z'), description: 'Two' },
  ];

  it('writes one UTC VEVENT per item with openlumo UIDs', () => {
    const ics = buildCalendarFile(items);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART:20261201T093000Z');
    expect(ics).toContain('DTEND:20261201T100000Z');
    expect(ics).toContain('UID:a1@openlumo');
    expect(ics).toContain('UID:b2@openlumo');
  });
});

describe('buildCalendarFile without items', () => {
  it('still returns a valid empty calendar', () => {
    expect(buildCalendarFile([])).toContain('BEGIN:VCALENDAR');
  });
});

describe('buildCalendarFile titles', () => {
  it('truncates long titles to 120 characters', () => {
    const ics = buildCalendarFile([{ id: 'a', title: 'T'.repeat(300), scheduledAt: new Date('2026-12-01T09:00:00Z'), description: '' }]);
    const summary = ics.replace(/\r?\n[ \t]/g, '').match(/SUMMARY:(T+)/);
    expect(summary![1]).toHaveLength(120);
  });
});
