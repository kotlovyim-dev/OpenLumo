'use client';

import { useState, type FormEvent } from 'react';
import type { Channel, Goal } from '@openlumo/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createStrategyAction } from './actions';
import { channelDotClasses, channelLabels } from './channel-style';

const goals: { value: Goal; label: string; hint: string }[] = [
  { value: 'awareness', label: 'Awareness', hint: 'Get known by more of the right people.' },
  { value: 'leads', label: 'Leads', hint: 'Bring in enquiries and sign-ups.' },
  { value: 'sales', label: 'Sales', hint: 'Turn attention into purchases.' },
  { value: 'launch', label: 'Launch', hint: 'Make noise for something new.' },
];

const optionClasses =
  'flex cursor-pointer rounded-control border border-border has-[:checked]:border-violet has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lilac';

export function StrategyPicker({ brandId }: { brandId: string }) {
  const [goal, setGoal] = useState<Goal>('awareness');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function toggle(channel: Channel) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((entry) => entry !== channel) : [...current, channel],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const result = await createStrategyAction(brandId, goal, channels);
      if (!result.ok) setErrors(result.fieldErrors ?? { form: 'Something went wrong. Try again.' });
    } catch {
      setErrors({ form: 'Something went wrong. Try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Card>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-semibold tracking-tight">What is the goal?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((option) => (
              <label key={option.value} className={`${optionClasses} gap-3 p-3`}>
                <input
                  type="radio"
                  name="goal"
                  value={option.value}
                  checked={goal === option.value}
                  onChange={() => setGoal(option.value)}
                  className="mt-1 accent-violet"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-sm text-muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.goal && (
            <p role="alert" className="text-xs text-danger">
              {errors.goal}
            </p>
          )}
        </fieldset>
      </Card>
      <Card>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-semibold tracking-tight">Where will you publish?</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(channelLabels) as Channel[]).map((channel) => (
              <label key={channel} className={`${optionClasses} items-center gap-2 px-3 py-2 text-sm`}>
                <input
                  type="checkbox"
                  checked={channels.includes(channel)}
                  onChange={() => toggle(channel)}
                  className="accent-violet"
                />
                <span aria-hidden className={`size-2.5 rounded-full ${channelDotClasses[channel]}`} />
                {channelLabels[channel]}
              </label>
            ))}
          </div>
          {errors.channels && (
            <p role="alert" className="text-xs text-danger">
              {errors.channels}
            </p>
          )}
        </fieldset>
      </Card>
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Starting...' : 'Create my strategy'}
      </Button>
    </form>
  );
}
