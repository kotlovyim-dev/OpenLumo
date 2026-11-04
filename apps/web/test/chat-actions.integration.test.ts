import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { addBrandMember, createBrand, createQueue, insertChatMessage, type Queue } from '@openlumo/core';
import { chatMessages, jobRuns, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { listChatMessages, retryChatReply, sendChatMessage } from '../src/features/chat/chat-service';

vi.mock('server-only', () => ({}));

describe('chat actions', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let boss: Queue;
  let brandId: string;

  const editor = { id: 'editor' };
  const viewer = { id: 'viewer' };
  const stranger = { id: 'stranger' };
  const context = (user: { id: string }) => ({ db: database.db, boss, user });

  beforeAll(async () => {
    database = await createTestDatabase();
    boss = await createQueue(database.url, { createQueues: true, supervise: false, schedule: false });
    for (const id of ['editor', 'viewer', 'stranger']) {
      await database.db.insert(users).values({ id, name: id, email: `${id}@example.com` });
    }
    brandId = (await createBrand(database.db, { name: 'Acme', createdBy: 'editor' })).id;
    await addBrandMember(database.db, brandId, 'viewer', 'viewer');
  });

  afterAll(async () => {
    await boss.stop();
    await database.drop();
  });

  async function chatRuns() {
    return database.db.select().from(jobRuns).where(eq(jobRuns.type, 'chat.reply'));
  }

  it('lets viewers and strangers not send', async () => {
    for (const user of [viewer, stranger]) {
      expect(await sendChatMessage(context(user), brandId, 'Hello')).toEqual({ ok: false, error: 'not_found' });
    }
    expect(await database.db.select().from(chatMessages)).toHaveLength(0);
    expect(await chatRuns()).toHaveLength(0);
  });

  it('rejects blank and overlong messages', async () => {
    for (const content of ['   ', 'x'.repeat(4001), 42]) {
      expect(await sendChatMessage(context(editor), brandId, content)).toEqual({ ok: false, error: 'invalid_input' });
    }
  });

  it('stores the trimmed message and enqueues one reply run keyed by the message', async () => {
    const result = await sendChatMessage(context(editor), brandId, '  Draft a post for Friday  ');
    if (!result.ok) throw new Error(result.error);

    const [message] = await database.db.select().from(chatMessages).where(eq(chatMessages.id, result.messageId));
    expect(message).toMatchObject({ brandId, userId: 'editor', role: 'user', content: 'Draft a post for Friday' });

    const runs = await chatRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ brandId, idempotencyKey: `chat:${result.messageId}`, status: 'queued' });
    const job = await boss.getJobById<Record<string, unknown>>('chat.reply', runs[0]!.id);
    expect(job?.data).toEqual({ brandId, messageId: result.messageId });

    expect(await retryChatReply(context(editor), brandId, result.messageId)).toEqual({ ok: true });
    expect(await chatRuns()).toHaveLength(1);
  });

  it('shows viewers the history with the pending reply, and a failed reply can be retried', async () => {
    const listed = await listChatMessages(context(viewer), brandId);
    if (!listed.ok) throw new Error(listed.error);
    const last = listed.messages.at(-1)!;
    expect(last).toMatchObject({ role: 'user', content: 'Draft a post for Friday', changedItems: false });
    expect(listed.pendingReply).toEqual({ messageId: last.id, status: 'queued', step: null });

    await database.db.update(jobRuns).set({ status: 'failed', step: 'Thinking' }).where(eq(jobRuns.idempotencyKey, `chat:${last.id}`));
    const failed = await listChatMessages(context(viewer), brandId);
    expect(failed).toMatchObject({ ok: true, pendingReply: { messageId: last.id, status: 'failed', step: 'Thinking' } });

    expect(await retryChatReply(context(viewer), brandId, last.id)).toEqual({ ok: false, error: 'not_found' });
    expect(await retryChatReply(context(editor), brandId, last.id)).toEqual({ ok: true });
    const runs = await chatRuns();
    expect(runs.filter((run) => run.status === 'queued')).toHaveLength(1);
    expect(runs).toHaveLength(2);

    await insertChatMessage(database.db, {
      brandId,
      userId: 'editor',
      role: 'assistant',
      content: 'Started a draft.\nIt lands in review.',
      toolCalls: [{ id: 'c1', name: 'create_draft', arguments: {}, result: 'Created', itemId: crypto.randomUUID() }],
      replyToId: last.id,
    });
    const answered = await listChatMessages(context(viewer), brandId);
    expect(answered).toMatchObject({ ok: true, pendingReply: null });
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Started a draft.\nIt lands in review.',
      changedItems: true,
    });
  });

  it('hides the history from strangers', async () => {
    expect(await listChatMessages(context(stranger), brandId)).toEqual({ ok: false, error: 'not_found' });
    expect(await listChatMessages(context(editor), 'not-a-uuid')).toEqual({ ok: false, error: 'not_found' });
  });
});
