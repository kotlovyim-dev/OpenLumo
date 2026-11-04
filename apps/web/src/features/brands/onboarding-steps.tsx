import { cn } from '@/lib/utils';

export const onboardingSteps = [
  { title: 'Read your site', detail: 'Pages, colours and logo' },
  { title: 'Research your market', detail: 'What the web says about you and who you compete with' },
  { title: 'Learn your brand', detail: 'Voice, audience and visuals, ready for you to review' },
];

type StepState = 'done' | 'active' | 'upcoming';

const stateLabel: Record<StepState, string> = { done: 'Done', active: 'In progress', upcoming: 'Up next' };

function StepMarker({ state, number }: { state: StepState; number: number }) {
  if (state === 'done') {
    return (
      <span className="flex size-7 shrink-0 animate-pop items-center justify-center rounded-full bg-violet text-violet-foreground">
        <span className="absolute size-7 animate-glow rounded-full" />
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} className="animate-draw" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
        state === 'active' ? 'animate-breathe border-violet text-lilac' : 'border-border text-muted',
      )}
    >
      {state === 'active' ? <span className="size-2.5 rounded-full bg-violet" /> : number}
    </span>
  );
}

export function OnboardingSteps({ current, className }: { current: number; className?: string }) {
  return (
    <ol aria-label="Steps" className={cn('flex flex-col', className)}>
      {onboardingSteps.map((step, index) => {
        const state: StepState = index < current ? 'done' : index === current ? 'active' : 'upcoming';
        return (
          <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
            {index < onboardingSteps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-3.5 top-8 bottom-1 w-px -translate-x-1/2 transition-colors duration-500',
                  index < current ? 'bg-violet' : 'bg-border',
                )}
              />
            )}
            <span className="relative">
              <StepMarker key={state} state={state} number={index + 1} />
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className={cn('text-sm font-semibold transition-colors', state === 'upcoming' && 'text-muted')}>
                {step.title}
                <span className="sr-only"> ({stateLabel[state]})</span>
              </span>
              <span className="text-sm text-muted">{step.detail}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
