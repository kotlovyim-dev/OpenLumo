import type { contentItems } from '@openlumo/db';

export type ItemStatus = (typeof contentItems.$inferSelect)['status'];
export type ItemAction = 'edit' | 'regenerate' | 'approve' | 'reject' | 'schedule' | 'export';

export class InvalidTransitionError extends Error {
  readonly retryable = false;
  readonly code = 'invalid_transition';

  constructor(current: ItemStatus, action: ItemAction) {
    super(`Cannot ${action} an item that is ${current}`);
    this.name = 'InvalidTransitionError';
  }
}

export function transitionItem(current: ItemStatus, action: ItemAction, hasSchedule: boolean): ItemStatus {
  const reviewable = current === 'suggested' || current === 'in_review';
  if ((action === 'edit' || action === 'regenerate') && reviewable) return 'in_review';
  if (action === 'approve' && reviewable) return hasSchedule ? 'scheduled' : 'approved';
  if (action === 'reject' && reviewable) return 'rejected';
  if (action === 'schedule' && current === 'approved') return 'scheduled';
  if (action === 'export' && (current === 'approved' || current === 'scheduled')) return 'exported';
  throw new InvalidTransitionError(current, action);
}
