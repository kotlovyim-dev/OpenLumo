import { describe, expect, it } from 'vitest';
import type { JobEvent } from '@openlumo/core';
import {
  agentSteps,
  describeAgent,
  DRAFT_STEP,
  FINISHED,
  followEvent,
  freshProgress,
  PLAN_STEP,
  type AgentProgress,
  type AgentSnapshot,
} from '../src/features/strategy/strategy-agent-steps';

const starting: AgentSnapshot = { step: 0, startedAt: '2026-11-04T10:00:00Z', planRunId: null, planned: null, pendingItemIds: [] };

function event(type: JobEvent['type'], status: JobEvent['status'], extra: Partial<JobEvent> = {}): JobEvent {
  return { runId: 'run', brandId: 'brand', type, status, ...extra };
}

function play(snapshot: AgentSnapshot, events: JobEvent[], progress: AgentProgress = freshProgress) {
  let refreshes = 0;
  for (const next of events) {
    const reaction = followEvent(progress, next, snapshot);
    progress = reaction.progress;
    if (reaction.refresh) refreshes += 1;
  }
  return { progress, refreshes, view: describeAgent(snapshot, progress) };
}

describe('strategy agent progress', () => {
  it('moves through each strategy section the worker reports', () => {
    const { view, refreshes } = play(starting, [
      event('strategy.create', 'running', { step: 'dna' }),
      event('strategy.create', 'running', { step: 'strengths' }),
      event('strategy.create', 'running', { step: 'pillars' }),
    ]);
    expect(agentSteps[view.current]!.id).toBe('pillars');
    expect(refreshes).toBe(0);
  });

  it('never steps backwards when events arrive late', () => {
    const { view } = play(starting, [
      event('strategy.create', 'running', { step: 'cadence' }),
      event('strategy.create', 'running', { step: 'gaps' }),
    ]);
    expect(agentSteps[view.current]!.id).toBe('cadence');
  });

  it('asks for fresh data once the strategy is saved and again once the month is planned', () => {
    const { view, refreshes } = play(starting, [
      event('strategy.create', 'succeeded'),
      event('plan.month', 'running', { runId: 'plan' }),
      event('plan.month', 'succeeded', { runId: 'plan' }),
    ]);
    expect(view.current).toBe(DRAFT_STEP);
    expect(view.planned).toBeNull();
    expect(refreshes).toBe(2);
  });

  it('ignores a plan run that belongs to someone else', () => {
    const planning = { ...starting, step: PLAN_STEP, planRunId: 'plan' };
    const { view } = play(planning, [event('plan.month', 'succeeded', { runId: 'top-up' })]);
    expect(view.current).toBe(PLAN_STEP);
  });

  it('counts drafts as they finish and completes when every post is done', () => {
    const drafting = { ...starting, step: DRAFT_STEP, planRunId: 'plan', planned: 5, pendingItemIds: ['a', 'b', 'c'] };
    const halfway = play(drafting, [
      event('item.generate', 'running', { itemId: 'a' }),
      event('item.generate', 'succeeded', { itemId: 'a' }),
      event('item.generate', 'succeeded', { itemId: 'a' }),
      event('item.generate', 'succeeded', { itemId: 'other' }),
    ]);
    expect(halfway.view).toMatchObject({ current: DRAFT_STEP, planned: 5, drafted: 3 });

    const done = play(drafting, [event('item.generate', 'failed', { itemId: 'b' }), event('item.generate', 'succeeded', { itemId: 'c' })], halfway.progress);
    expect(done.view).toMatchObject({ current: FINISHED, drafted: 5, failed: false });
  });

  it('shows a failure when the strategy job fails', () => {
    const { view } = play(starting, [event('strategy.create', 'failed')]);
    expect(view.failed).toBe(true);
  });
});
