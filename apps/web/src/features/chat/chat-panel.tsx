'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, MessageCircle, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useJobEvents } from '@/hooks/use-job-events';
import { cn } from '@/lib/utils';
import { listChatMessages, retryChatReply, sendChatMessage } from './actions';
import type { ChatEntry, PendingReply } from './chat-service';

const genericError = 'Something went wrong. Try again.';

export function ChatPanel({ brandId, canSend, maxLength }: { brandId: string; canSend: boolean; maxLength: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[] | null>(null);
  const [pending, setPending] = useState<PendingReply | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const load = useCallback(async () => {
    try {
      const result = await listChatMessages(brandId);
      setMessages(result.messages);
      setPending(result.pendingReply);
    } catch {
      setError(genericError);
    }
  }, [brandId]);

  useEffect(() => {
    if (open && messages === null) void load();
  }, [open, messages, load]);

  useEffect(() => {
    if (open) (inputRef.current ?? closeRef.current)?.focus();
    else if (wasOpen.current) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, pending]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch {
      setError(genericError);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    void run(async () => {
      const result = await sendChatMessage(brandId, content);
      if (result.ok) setDraft('');
      else setError(`Write a message of up to ${maxLength} characters.`);
    });
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const thinking = pending !== null && pending.status !== 'failed';

  return (
    <>
      {!open && (
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="chat-panel"
          className="fixed right-4 bottom-4 z-20 flex h-12 items-center gap-2 rounded-full border border-border bg-elevated px-4 text-sm font-semibold shadow-lg hover:bg-surface md:right-8 md:bottom-8"
        >
          <MessageCircle className="size-5 text-lilac" aria-hidden="true" />
          Ask Lumo
        </button>
      )}
      {(open || thinking) && <ChatEvents brandId={brandId} onSettled={load} onStep={setPending} />}
      {open && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        id="chat-panel"
        aria-label="Chat with Lumo"
        hidden={!open}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-2xl md:w-[400px]"
      >
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <img src="/brand/logo/lumo-mark.svg" alt="" width={32} height={32} className="size-8" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-sm font-semibold">Lumo</h2>
            <p className="truncate text-xs text-muted">Ideas, new drafts and changes for this brand</p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close chat"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          {messages?.length === 0 && (
            <p className="m-auto max-w-64 text-center text-sm text-muted">
              Ask Lumo for post ideas, a new draft or a change to an item on the board.
            </p>
          )}
          <ol aria-label="Messages" className="flex flex-col gap-4">
            {messages?.map((message) => (
              <ChatBubble key={message.id} brandId={brandId} message={message} />
            ))}
          </ol>
          {thinking && (
            <div role="status" className="flex items-center gap-3 text-sm">
              <span className="size-2 animate-pulse rounded-full bg-lilac motion-reduce:animate-none" aria-hidden="true" />
              <span>
                Lumo is thinking…
                {pending.step && <span className="ml-2 text-xs text-muted">{pending.step}</span>}
              </span>
            </div>
          )}
          {pending?.status === 'failed' && (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-card border border-danger/40 p-3 text-sm">
              <p>Lumo could not reply to your last message.</p>
              {canSend && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => retryChatReply(brandId, pending.messageId))}
                >
                  <RotateCw className="size-4" aria-hidden="true" />
                  Try again
                </Button>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {canSend ? (
          <form onSubmit={submit} className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
            <Label htmlFor="chat-message" className="sr-only">
              Message Lumo
            </Label>
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                id="chat-message"
                rows={1}
                value={draft}
                maxLength={maxLength}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={submitOnEnter}
                placeholder="Ask Lumo…"
                className="max-h-40"
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={busy || thinking || !draft.trim()}>
                <ArrowUp className="size-5" aria-hidden="true" />
              </Button>
            </div>
            <p role="status" aria-live="polite" className="text-xs text-danger empty:hidden">
              {error}
            </p>
          </form>
        ) : (
          <p className="shrink-0 border-t border-border p-4 text-sm text-muted">
            You have view access, so you can read this chat but not send messages.
          </p>
        )}
      </aside>
    </>
  );
}

function ChatBubble({ brandId, message }: { brandId: string; message: ChatEntry }) {
  const fromTeam = message.role === 'user';
  return (
    <li className={cn('flex flex-col gap-1', fromTeam ? 'items-end' : 'items-start')}>
      <span className="text-xs text-muted">{fromTeam ? 'Team' : 'Lumo'}</span>
      <p
        className={cn(
          'max-w-[85%] rounded-card px-3 py-2 text-sm break-words whitespace-pre-wrap',
          fromTeam ? 'bg-violet text-violet-foreground' : 'bg-elevated',
        )}
      >
        {message.content}
      </p>
      {message.changedItems && (
        <Link
          href={`/brands/${brandId}/board`}
          className="text-xs font-semibold text-lilac underline-offset-4 hover:underline"
        >
          Open the board
        </Link>
      )}
    </li>
  );
}

function ChatEvents({
  brandId,
  onSettled,
  onStep,
}: {
  brandId: string;
  onSettled: () => Promise<void>;
  onStep: (update: (current: PendingReply | null) => PendingReply | null) => void;
}) {
  useJobEvents(
    brandId,
    (event) => {
      if (event.type !== 'chat.reply') return;
      if (event.status === 'succeeded' || event.status === 'failed') void onSettled();
      else if (event.step) {
        const step = event.step;
        onStep((current) => (current && current.status !== 'failed' ? { ...current, status: 'running', step } : current));
      }
    },
    () => void onSettled(),
  );
  return null;
}
