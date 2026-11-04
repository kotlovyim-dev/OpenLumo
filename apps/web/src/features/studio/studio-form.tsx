'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Minus, Plus, Sparkles } from 'lucide-react';
import type { Channel, ItemFormat } from '@openlumo/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatLabels } from '../board/item-card';
import { channelDotClasses, channelLabels } from '../strategy/channel-style';
import { generateOnDemand } from './actions';

const channelOrder: Channel[] = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'email', 'blog'];

const optionClasses =
  'flex h-10 cursor-pointer items-center gap-2 rounded-control border border-border px-3 text-sm font-medium has-[:checked]:border-violet has-[:checked]:bg-elevated has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lilac';

export function StudioForm({
  brandId,
  channelFormats,
  maxInstructionLength,
  maxVariants,
}: {
  brandId: string;
  channelFormats: Record<Channel, ItemFormat[]>;
  maxInstructionLength: number;
  maxVariants: number;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>(channelOrder[0]!);
  const [format, setFormat] = useState<ItemFormat>(channelFormats[channelOrder[0]!][0]!);
  const [instruction, setInstruction] = useState('');
  const [variants, setVariants] = useState(2);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pickChannel(next: Channel) {
    setChannel(next);
    if (!channelFormats[next].includes(format)) setFormat(channelFormats[next][0]!);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await generateOnDemand(brandId, { channel, format, instruction, variants });
      if (result.ok) {
        setMessage(
          result.itemIds.length === 1 ? 'Lumo is drafting your variant.' : `Lumo is drafting ${result.itemIds.length} variants.`,
        );
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage('Check the highlighted fields.');
      }
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Channel</legend>
          <div className="flex flex-wrap gap-2">
            {channelOrder.map((option) => (
              <label key={option} className={optionClasses}>
                <input
                  type="radio"
                  name="channel"
                  value={option}
                  checked={channel === option}
                  onChange={() => pickChannel(option)}
                  className="sr-only"
                />
                <span className={`size-2 rounded-full ${channelDotClasses[option]}`} aria-hidden="true" />
                {channelLabels[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Format</legend>
          <div className="flex flex-wrap gap-2">
            {channelFormats[channel].map((option) => (
              <label key={option} className={optionClasses}>
                <input
                  type="radio"
                  name="format"
                  value={option}
                  checked={format === option}
                  onChange={() => setFormat(option)}
                  className="sr-only"
                />
                {formatLabels[option]}
              </label>
            ))}
          </div>
          {errors.format && (
            <p role="alert" className="text-xs text-danger">
              {errors.format}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="studio-instruction">What should Lumo make? (optional)</Label>
          <Textarea
            id="studio-instruction"
            value={instruction}
            maxLength={maxInstructionLength}
            rows={3}
            aria-invalid={errors.instruction ? true : undefined}
            aria-describedby="studio-instruction-count"
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="For example: a teaser for Friday's launch, playful, lead with the free trial."
          />
          <p id="studio-instruction-count" className="text-right text-xs tabular-nums text-muted">
            {instruction.length}/{maxInstructionLength}
          </p>
          {errors.instruction && (
            <p role="alert" className="text-xs text-danger">
              {errors.instruction}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span id="studio-variants-label" className="text-sm font-medium">
              Variants
            </span>
            <div role="group" aria-labelledby="studio-variants-label" className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Fewer variants"
                disabled={variants <= 1}
                onClick={() => setVariants((count) => count - 1)}
              >
                <Minus className="size-4" aria-hidden="true" />
              </Button>
              <output aria-live="polite" className="w-10 text-center text-lg font-semibold tabular-nums">
                {variants}
              </output>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="More variants"
                disabled={variants >= maxVariants}
                onClick={() => setVariants((count) => count + 1)}
              >
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            <Sparkles className="size-4" aria-hidden="true" />
            {pending ? 'Starting…' : 'Generate'}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
          {message}
        </p>
      </form>
    </Card>
  );
}
