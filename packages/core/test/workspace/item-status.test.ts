import { describe, expect, it } from 'vitest';
import { InvalidTransitionError, type ItemAction, type ItemStatus, transitionItem } from '../../src/workspace/item-status';

const statuses: ItemStatus[] = ['suggested', 'in_review', 'approved', 'scheduled', 'exported', 'rejected'];
const actions: ItemAction[] = ['edit', 'regenerate', 'approve', 'reject', 'schedule', 'export'];

type Expected = { plain: ItemStatus; withSchedule?: ItemStatus };

const table: Record<ItemStatus, Partial<Record<ItemAction, Expected>>> = {
  suggested: {
    edit: { plain: 'in_review' },
    regenerate: { plain: 'in_review' },
    approve: { plain: 'approved', withSchedule: 'scheduled' },
    reject: { plain: 'rejected' },
  },
  in_review: {
    edit: { plain: 'in_review' },
    regenerate: { plain: 'in_review' },
    approve: { plain: 'approved', withSchedule: 'scheduled' },
    reject: { plain: 'rejected' },
  },
  approved: { schedule: { plain: 'scheduled' }, export: { plain: 'exported' } },
  scheduled: { export: { plain: 'exported' } },
  exported: {},
  rejected: {},
};

describe('transitionItem', () => {
  for (const status of statuses) {
    for (const action of actions) {
      const expected = table[status][action];
      it(`${status} + ${action}`, () => {
        for (const hasSchedule of [false, true]) {
          if (!expected) {
            expect(() => transitionItem(status, action, hasSchedule)).toThrow(InvalidTransitionError);
          } else {
            const target = hasSchedule ? (expected.withSchedule ?? expected.plain) : expected.plain;
            expect(transitionItem(status, action, hasSchedule)).toBe(target);
          }
        }
      });
    }
  }

  it('throws a duck-typed non-retryable error', () => {
    expect(() => transitionItem('rejected', 'approve', false)).toThrow(
      expect.objectContaining({ code: 'invalid_transition', retryable: false }),
    );
  });
});
