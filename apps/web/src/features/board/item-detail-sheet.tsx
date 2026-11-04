'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { LocalTime, useBrowserValue } from '@/components/local-time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { channelLabels } from '../strategy/channel-style';
import { approveItem, editItemCopy, regenerateItem, rejectItem, restoreVersion, scheduleItem } from './actions';
import type { ItemDetail, ItemStatus } from './board-service';
import { CopyEditor, type CopyValue } from './copy-editor';
import { formatLabels } from './item-card';
import type { ItemResult } from './item-service';

const statusLabels: Record<ItemStatus, string> = {
  suggested: 'Suggested',
  in_review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  exported: 'Exported',
  rejected: 'Rejected',
};

const authorLabels = { user: 'Team', planner: 'Planner', chat: 'Chat' } as const;

const scopes = [
  { value: 'all', label: 'Copy and image' },
  { value: 'copy', label: 'Copy only' },
  { value: 'image', label: 'Image only' },
] as const;

const errorMessages: Record<Exclude<ItemResult, { ok: true }>['error'], string> = {
  not_found: 'This item is no longer available.',
  invalid_input: 'Check the highlighted fields.',
  invalid_transition: 'This item cannot do that in its current state.',
  conflict: 'This item changed meanwhile. Close it and open it again.',
};

const genericError = 'Something went wrong. Try again.';

function toLocalInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ItemDetailSheet({ brandId, detail, canEdit }: { brandId: string; detail: ItemDetail; canEdit: boolean }) {
  const router = useRouter();
  const sheetRef = useRef<HTMLDialogElement>(null);
  const rejectRef = useRef<HTMLDialogElement>(null);
  const current = detail.versions.find((version) => version.number === detail.currentVersionNumber);
  const [copy, setCopy] = useState(current?.copy as CopyValue | undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scope, setScope] = useState<'copy' | 'image' | 'all'>('all');
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const scheduledLocal = useBrowserValue(() => (detail.scheduledAt ? toLocalInput(detail.scheduledAt) : ''), '');

  const reviewable = detail.status === 'suggested' || detail.status === 'in_review';
  const schedulable = reviewable || detail.status === 'approved' || detail.status === 'scheduled';
  const copyEditable = canEdit && reviewable;
  const boardHref = `/brands/${brandId}/board`;

  useEffect(() => {
    sheetRef.current?.showModal();
  }, []);

  async function perform(action: () => Promise<ItemResult>, onSuccess?: () => void) {
    setPending(true);
    setMessage(null);
    setErrors({});
    try {
      const result = await action();
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(errorMessages[result.error]);
      }
    } catch {
      setMessage(genericError);
    } finally {
      setPending(false);
    }
  }

  function saveCopy(event: FormEvent) {
    event.preventDefault();
    void perform(() => editItemCopy(detail.id, copy));
  }

  function regenerate(event: FormEvent) {
    event.preventDefault();
    void perform(
      () => regenerateItem(detail.id, scope, feedback),
      () => {
        setFeedback('');
        setMessage('Lumo is regenerating this item.');
      },
    );
  }

  function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(String(new FormData(event.currentTarget).get('scheduledAt')));
    if (Number.isNaN(date.getTime())) {
      setErrors({ scheduledAt: 'Pick a valid date and time.' });
      return;
    }
    void perform(() => scheduleItem(detail.id, date.toISOString()));
  }

  function reject(event: FormEvent) {
    event.preventDefault();
    void perform(
      () => rejectItem(detail.id, reason),
      () => {
        rejectRef.current?.close();
        sheetRef.current?.close();
      },
    );
  }

  return (
    <dialog
      ref={sheetRef}
      aria-labelledby="item-detail-title"
      onClose={(event) => event.target === event.currentTarget && router.push(boardHref, { scroll: false })}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-xl overflow-y-auto border-l border-border bg-surface p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted">
              {channelLabels[detail.channel]} · {formatLabels[detail.format]}
              {detail.pillar && ` · ${detail.pillar}`}
            </p>
            <h2 id="item-detail-title" className="text-lg font-semibold tracking-tight">
              {statusLabels[detail.status]}
            </h2>
            {detail.angle && <p className="text-sm text-muted">{detail.angle}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={() => sheetRef.current?.close()}>
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>

        {current && current.assetIds.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {current.assetIds.map((assetId) => (
              <img
                key={assetId}
                src={`/api/assets/${assetId}`}
                alt=""
                className="aspect-square w-full rounded-control bg-elevated object-cover"
              />
            ))}
          </div>
        )}

        {copy === undefined ? (
          <p className="text-sm text-muted">Lumo is still drafting this item.</p>
        ) : (
          <form onSubmit={saveCopy} className="flex flex-col gap-4">
            <CopyEditor value={copy} onChange={setCopy} errors={errors} readOnly={!copyEditable} />
            {copyEditable && (
              <Button type="submit" className="self-start" disabled={pending}>
                Save copy
              </Button>
            )}
          </form>
        )}

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
          {message}
        </p>

        {canEdit && reviewable && (
          <section aria-labelledby="review-heading" className="flex flex-col gap-3">
            <h3 id="review-heading" className="text-sm font-semibold">
              Review
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => void perform(() => approveItem(detail.id))}>
                Approve
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => rejectRef.current?.showModal()}>
                Reject
              </Button>
            </div>
            <form onSubmit={regenerate} className="flex flex-col gap-3 rounded-card border border-border p-4">
              <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
                <legend className="mb-2 text-sm font-medium">Regenerate</legend>
                {scopes.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="scope"
                      value={option.value}
                      checked={scope === option.value}
                      onChange={() => setScope(option.value)}
                      className="accent-violet"
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="regenerate-feedback">Feedback for Lumo (optional)</Label>
                <Textarea
                  id="regenerate-feedback"
                  value={feedback}
                  maxLength={500}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="For example: shorter, and lead with the offer."
                />
              </div>
              <Button type="submit" variant="outline" className="self-start" disabled={pending}>
                Regenerate
              </Button>
            </form>
          </section>
        )}

        {canEdit && schedulable && (
          <form onSubmit={schedule} className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-at">{detail.scheduledAt ? 'Scheduled for' : 'Schedule for'}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                key={scheduledLocal}
                id="schedule-at"
                name="scheduledAt"
                type="datetime-local"
                required
                defaultValue={scheduledLocal}
                aria-invalid={errors.scheduledAt ? true : undefined}
                className="w-auto"
              />
              <Button type="submit" variant="outline" disabled={pending}>
                {detail.scheduledAt ? 'Reschedule' : 'Schedule'}
              </Button>
            </div>
            {errors.scheduledAt && (
              <p role="alert" className="text-xs text-danger">
                {errors.scheduledAt}
              </p>
            )}
          </form>
        )}

        {!canEdit && detail.scheduledAt && (
          <p className="text-sm text-muted">
            Scheduled for <LocalTime value={detail.scheduledAt} />
          </p>
        )}

        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h3 id="history-heading" className="text-sm font-semibold">
            Version history
          </h3>
          {detail.versions.length === 0 ? (
            <p className="text-sm text-muted">No versions yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {detail.versions.map((version) => (
                <li
                  key={version.number}
                  className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2 text-sm"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">
                      Version {version.number} · {authorLabels[version.author]}
                    </span>
                    <span className="text-xs text-muted">
                      <LocalTime value={version.createdAt} />
                    </span>
                  </span>
                  {version.number === detail.currentVersionNumber ? (
                    <span className="text-xs text-lilac">Current</span>
                  ) : (
                    copyEditable &&
                    version.number < (detail.currentVersionNumber ?? 0) && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        disabled={pending}
                        onClick={() => void perform(() => restoreVersion(detail.id, version.number))}
                      >
                        Restore
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <dialog
        ref={rejectRef}
        aria-labelledby="reject-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-border bg-elevated p-6 text-foreground backdrop:bg-black/60"
      >
        <form onSubmit={reject} className="flex flex-col gap-4">
          <h2 id="reject-title" className="text-lg font-semibold tracking-tight">
            Reject this item
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject-reason">Why does it miss the mark? Lumo learns from this.</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              required
              maxLength={500}
              aria-invalid={errors.reason ? true : undefined}
              onChange={(event) => setReason(event.target.value)}
            />
            {errors.reason && (
              <p role="alert" className="text-xs text-danger">
                {errors.reason}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => rejectRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || reason.trim() === ''}>
              Reject
            </Button>
          </div>
        </form>
      </dialog>
    </dialog>
  );
}
