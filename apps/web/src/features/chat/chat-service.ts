import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  enqueue,
  findUserChatMessage,
  hasChatReply,
  insertChatMessage,
  listRecentChatMessages,
  type ChatMessage,
  type Queue,
} from '@openlumo/core';
import { jobRuns, type Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import type { ChatEntry, PendingReply } from './chat-types';

export type ChatServiceContext = { db: Database; boss: Queue; user: { id: string } };

export type ChatHistoryResult =
  | { ok: true; messages: ChatEntry[]; pendingReply: PendingReply | null }
  | { ok: false; error: 'not_found' };

export type SendResult = { ok: true; messageId: string } | { ok: false; error: 'not_found' | 'invalid_input' };

export type RetryResult = { ok: true } | { ok: false; error: 'not_found' };

export const MAX_CHAT_MESSAGE_LENGTH = 4000;
const HISTORY_LENGTH = 50;

const contentSchema = z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH);
const notFound = { ok: false, error: 'not_found' } as const;

const replyKey = (messageId: string) => `chat:${messageId}`;

function enqueueReply(context: ChatServiceContext, brandId: string, messageId: string) {
  return enqueue(context.boss, context.db, 'chat.reply', { brandId, messageId }, { idempotencyKey: replyKey(messageId) });
}

function changedItems(toolCalls: unknown): boolean {
  return Array.isArray(toolCalls) && toolCalls.some((call) => typeof (call as { itemId?: unknown })?.itemId === 'string');
}

export async function sendChatMessage(context: ChatServiceContext, brandId: string, content: unknown): Promise<SendResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return notFound;
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const message = await insertChatMessage(context.db, {
    brandId,
    userId: context.user.id,
    role: 'user',
    content: parsed.data,
  });
  await enqueueReply(context, brandId, message!.id);
  return { ok: true, messageId: message!.id };
}

export async function retryChatReply(context: ChatServiceContext, brandId: string, messageId: string): Promise<RetryResult> {
  if (!z.uuid().safeParse(messageId).success) return notFound;
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return notFound;
  if (!(await findUserChatMessage(context.db, brandId, messageId))) return notFound;
  if (!(await hasChatReply(context.db, messageId))) await enqueueReply(context, brandId, messageId);
  return { ok: true };
}

async function findPendingReply(db: Database, messages: ChatMessage[]): Promise<PendingReply | null> {
  const latest = messages.findLast((message) => message.role === 'user');
  if (!latest || messages.some((message) => message.replyToId === latest.id)) return null;
  const [run] = await db
    .select({ status: jobRuns.status, step: jobRuns.step })
    .from(jobRuns)
    .where(eq(jobRuns.idempotencyKey, replyKey(latest.id)));
  if (run?.status === 'succeeded') return null;
  return { messageId: latest.id, status: run?.status ?? 'failed', step: run?.step ?? null };
}

export async function listChatMessages(context: ChatServiceContext, brandId: string): Promise<ChatHistoryResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'viewer'))) return notFound;
  const messages = await listRecentChatMessages(context.db, brandId, HISTORY_LENGTH);
  return {
    ok: true,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      changedItems: changedItems(message.toolCalls),
    })),
    pendingReply: await findPendingReply(context.db, messages),
  };
}
