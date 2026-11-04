'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useJobEvents } from '@/hooks/use-job-events';
import { addFeedbackAction, mergeFeedbackAction } from './actions';

export function FeedbackPanel({
  brandId,
  notes,
  canEdit,
}: {
  brandId: string;
  notes: { id: string; note: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useJobEvents(brandId, (event) => {
    if (event.type !== 'brand.synthesize-dna') return;
    if (event.status === 'succeeded' || event.status === 'failed') {
      setStep(null);
      if (event.status === 'failed') setError('Lumo could not apply your feedback. Try again.');
      router.refresh();
      return;
    }
    setStep(event.step ?? 'Applying your feedback');
  });

  async function add(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = await addFeedbackAction(brandId, draft);
    if (!result.ok) {
      setError(result.fieldErrors?.note ?? 'Something went wrong. Try again.');
      return;
    }
    setDraft('');
    router.refresh();
  }

  async function merge() {
    setError(null);
    setStep('Applying your feedback');
    const result = await mergeFeedbackAction(brandId);
    if (!result.ok) {
      setStep(null);
      setError('Something went wrong. Try again.');
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Feedback</h2>
      {canEdit && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <Label htmlFor="feedback-note">Tell Lumo what is off about your brand profile</Label>
          <textarea
            id="feedback-note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="For example: we sound friendlier than this, and we never use exclamation marks."
            className="w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
          />
          <Button type="submit" variant="outline" className="self-start" disabled={draft.trim() === ''}>
            Add note
          </Button>
        </form>
      )}
      {notes.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {notes.map(({ id, note }) => (
            <li key={id} className="rounded-control border border-border bg-elevated px-3 py-2 text-sm">
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No open notes.</p>
      )}
      <div aria-live="polite" className="flex items-center gap-4">
        {canEdit && notes.length > 0 && (
          <Button type="button" onClick={merge} disabled={step !== null}>
            Apply feedback
          </Button>
        )}
        {step && <p className="text-sm text-muted">{step}</p>}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
