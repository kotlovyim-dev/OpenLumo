import type { JobEvent, StrategySection } from '@openlumo/core';

type AgentStepId = 'dna' | StrategySection | 'plan' | 'draft';

export const agentSteps: { id: AgentStepId; title: string; detail: string }[] = [
  { id: 'dna', title: 'Read your Brand DNA', detail: 'Voice, audience and what sets you apart' },
  { id: 'strengths', title: 'Find what you do well', detail: 'The strengths your content can lean on' },
  { id: 'gaps', title: 'Spot the gaps', detail: 'Where you are quiet or easy to miss' },
  { id: 'pillars', title: 'Choose content pillars', detail: 'The themes you will keep coming back to' },
  { id: 'cadence', title: 'Set a posting rhythm', detail: 'How often to show up on each channel' },
  { id: 'campaignIdeas', title: 'Sketch campaign ideas', detail: 'Bigger moments worth building towards' },
  { id: 'plan', title: 'Plan your first month', detail: 'Dates, channels and angles for every post' },
  { id: 'draft', title: 'Draft your posts', detail: 'Copy and visuals for every slot' },
];

export const PLAN_STEP = agentSteps.findIndex((step) => step.id === 'plan');
export const DRAFT_STEP = agentSteps.findIndex((step) => step.id === 'draft');
export const FINISHED = agentSteps.length;

export type AgentSnapshot = {
  step: number;
  startedAt: string;
  planRunId: string | null;
  planned: number | null;
  pendingItemIds: string[];
};

export type AgentProgress = { reached: number; finishedItemIds: string[]; failed: boolean };

export const freshProgress: AgentProgress = { reached: 0, finishedItemIds: [], failed: false };

export function strategyStepIndex(step: string | null | undefined): number {
  const index = agentSteps.findIndex(({ id }) => id === step);
  return index >= 0 && index < PLAN_STEP ? index : 0;
}

function reach(progress: AgentProgress, step: number): AgentProgress {
  return step > progress.reached ? { ...progress, reached: step } : progress;
}

function isPlanRun(event: JobEvent, snapshot: AgentSnapshot, progress: AgentProgress): boolean {
  if (snapshot.planRunId) return event.runId === snapshot.planRunId;
  return Math.max(snapshot.step, progress.reached) === PLAN_STEP;
}

export function followEvent(
  progress: AgentProgress,
  event: JobEvent,
  snapshot: AgentSnapshot,
): { progress: AgentProgress; refresh: boolean } {
  const unchanged = { progress, refresh: false };
  if (event.type === 'strategy.create') {
    if (event.status === 'failed') return { progress: { ...progress, failed: true }, refresh: false };
    if (event.status === 'succeeded') return { progress: reach(progress, PLAN_STEP), refresh: true };
    return { progress: reach(progress, strategyStepIndex(event.step)), refresh: false };
  }
  if (event.type === 'plan.month' && isPlanRun(event, snapshot, progress)) {
    if (event.status === 'failed') return { progress: { ...progress, failed: true }, refresh: false };
    if (event.status === 'succeeded') return { progress: reach(progress, DRAFT_STEP), refresh: true };
    return { progress: reach(progress, PLAN_STEP), refresh: false };
  }
  if (event.type === 'item.generate' && event.itemId && snapshot.pendingItemIds.includes(event.itemId)) {
    if (event.status !== 'succeeded' && event.status !== 'failed') return unchanged;
    if (progress.finishedItemIds.includes(event.itemId)) return unchanged;
    return { progress: { ...progress, finishedItemIds: [...progress.finishedItemIds, event.itemId] }, refresh: false };
  }
  return unchanged;
}

export function describeAgent(snapshot: AgentSnapshot, progress: AgentProgress) {
  const reached = Math.max(snapshot.step, progress.reached);
  const remaining = snapshot.pendingItemIds.filter((id) => !progress.finishedItemIds.includes(id)).length;
  const planned = reached >= DRAFT_STEP ? snapshot.planned : null;
  const drafted = planned === null ? 0 : planned - remaining;
  const finished = planned !== null && remaining === 0;
  return { current: finished ? FINISHED : reached, planned, drafted, failed: progress.failed && !finished };
}
