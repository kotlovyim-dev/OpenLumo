'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useJobEvents } from '@/hooks/use-job-events';
import { cn } from '@/lib/utils';
import {
  agentSteps,
  describeAgent,
  DRAFT_STEP,
  FINISHED,
  followEvent,
  freshProgress,
  PLAN_STEP,
  type AgentSnapshot,
} from './strategy-agent-steps';

type StepState = 'done' | 'active' | 'upcoming';

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Elapsed({ startedAt, running }: { startedAt: string; running: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return <span className="tabular-nums">{now === null ? '0:00' : formatElapsed(now - Date.parse(startedAt))}</span>;
}

function WorkingDots() {
  return (
    <span aria-hidden className="ml-1 inline-flex gap-0.5 align-middle">
      {[0, 1, 2].map((dot) => (
        <span key={dot} style={{ animationDelay: `${dot * 160}ms` }} className="size-1 animate-pulse rounded-full bg-lilac" />
      ))}
    </span>
  );
}

function StepMarker({ state, number }: { state: StepState; number: number }) {
  if (state === 'done') {
    return (
      <span className="relative flex size-7 shrink-0 animate-pop items-center justify-center rounded-full bg-violet text-violet-foreground">
        <span className="absolute inset-0 animate-glow rounded-full" />
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} className="animate-draw" />
        </svg>
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-violet">
        <span className="absolute inset-[-3px] animate-spin rounded-full border-2 border-transparent border-t-violet" />
        <span className="size-2.5 animate-breathe rounded-full bg-violet" />
      </span>
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted">
      {number}
    </span>
  );
}

function DraftMeter({ planned, drafted }: { planned: number | null; drafted: number }) {
  if (planned === null) {
    return (
      <span className="text-sm text-muted">
        Lining up your posts
        <WorkingDots />
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">
        <span key={drafted} className="inline-block animate-pop font-semibold text-foreground">
          {drafted}
        </span>{' '}
        of {planned} written
        <WorkingDots />
      </span>
      <span className="h-1 w-48 max-w-full overflow-hidden rounded-full bg-elevated">
        <span
          className="block h-full rounded-full bg-violet transition-[width] duration-700 ease-out"
          style={{ width: `${planned === 0 ? 100 : (drafted / planned) * 100}%` }}
        />
      </span>
    </span>
  );
}

function stepDetail(index: number, state: StepState, planned: number | null, drafted: number) {
  if (index === DRAFT_STEP && state === 'active') return <DraftMeter planned={planned} drafted={drafted} />;
  if (index === PLAN_STEP && state === 'done' && planned !== null) {
    return <span className="animate-rise text-sm text-muted">{planned} posts on your calendar</span>;
  }
  if (index === DRAFT_STEP && state === 'done' && planned !== null) {
    return <span className="animate-rise text-sm text-muted">{planned} drafts ready for review</span>;
  }
  return (
    <span className="text-sm text-muted">
      {agentSteps[index]!.detail}
      {state === 'active' && <WorkingDots />}
    </span>
  );
}

export function StrategyAgent({ brandId, snapshot }: { brandId: string; snapshot: AgentSnapshot }) {
  const router = useRouter();
  const [progress, setProgress] = useState(freshProgress);
  const { current, planned, drafted, failed } = describeAgent(snapshot, progress);
  const finished = current === FINISHED;
  const percent = Math.round((Math.min(current, FINISHED) / FINISHED) * 100);

  useJobEvents(
    brandId,
    (event) => {
      setProgress((previous) => followEvent(previous, event, snapshot).progress);
      if (followEvent(progress, event, snapshot).refresh) router.refresh();
    },
    () => router.refresh(),
  );

  const title = failed
    ? 'Lumo hit a snag'
    : finished
      ? 'Your strategy and first month are ready'
      : current >= PLAN_STEP
        ? 'Lumo is planning your first month'
        : 'Lumo is building your strategy';

  return (
    <Card className="flex flex-col gap-5">
      <header className="flex items-start gap-4">
        <div
          className={cn(
            'relative flex size-12 shrink-0 items-center justify-center rounded-card border border-border bg-elevated',
            finished ? 'animate-pop' : !failed && 'animate-breathe',
          )}
        >
          <img src="/brand/logo/lumo-mark.svg" alt="" width={28} height={28} className="size-7" />
          {finished && (
            <span className="absolute -bottom-1.5 -right-1.5 flex size-5 animate-pop items-center justify-center rounded-full bg-violet text-violet-foreground">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
          )}
        </div>
        <div aria-live="polite" className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 key={title} className="animate-rise text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted">
            {failed
              ? 'Something went wrong part way through. Nothing is lost, you can try again.'
              : finished
                ? 'Every post has a first draft waiting for you on the board.'
                : `Step ${current + 1} of ${FINISHED}: ${agentSteps[current]!.title}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted">
          <Elapsed startedAt={snapshot.startedAt} running={!finished && !failed} />
        </span>
      </header>

      <div
        role="progressbar"
        aria-label="Strategy progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 rounded-full bg-elevated"
      >
        <span
          className={cn(
            'relative block h-full rounded-full transition-[width] duration-700 ease-out',
            failed ? 'bg-danger' : 'bg-violet',
          )}
          style={{ width: `${Math.max(percent, 4)}%` }}
        >
          {!finished && !failed && (
            <span className="absolute -right-0.5 top-1/2 size-2.5 -translate-y-1/2 animate-ping rounded-full bg-violet" />
          )}
        </span>
      </div>

      <ol aria-label="Steps" className="flex flex-col">
        {agentSteps.map((step, index) => {
          const state: StepState = index < current ? 'done' : index === current && !failed ? 'active' : 'upcoming';
          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < agentSteps.length - 1 && (
                <span aria-hidden className="absolute bottom-0.5 left-3.5 top-8 w-px -translate-x-1/2 overflow-hidden bg-border">
                  <span
                    className={cn(
                      'block w-full bg-violet transition-[height] duration-500 ease-out',
                      index < current ? 'h-full' : 'h-0',
                    )}
                  />
                </span>
              )}
              <StepMarker key={state} state={state} number={index + 1} />
              <div className={cn('flex min-w-0 flex-col gap-0.5 pt-0.5', state === 'active' && 'animate-rise')}>
                <span className={cn('text-sm font-semibold transition-colors', state === 'upcoming' && 'text-muted')}>
                  {step.title}
                </span>
                {stepDetail(index, state, planned, drafted)}
              </div>
            </li>
          );
        })}
      </ol>

      {(finished || failed) && (
        <div className="flex animate-rise flex-wrap gap-3">
          {finished ? (
            <Link href={`/brands/${brandId}/board`} className={buttonVariants()}>
              Review your drafts
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <Button onClick={() => router.refresh()}>Try again</Button>
          )}
        </div>
      )}
    </Card>
  );
}
