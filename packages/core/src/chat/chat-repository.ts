import { and, desc, eq, sql } from 'drizzle-orm';
import { chatMessages, contentItems, itemVersions, type Database } from '@openlumo/db';
import type { ToolCall } from '@openlumo/providers';
import { getBrandDna } from '../brand-dna/brand-dna-repository';
import { BrandNotReadyError } from '../planner/brand-not-ready-error';
import { findLatestStrategyId, findStrategy } from '../planner/planner-repository';
import { strategyDocumentSchema } from '../planner/strategy-schema';
import { copyTitle } from '../workspace/copy-title';
import type { ToolOutcome } from './chat-tools';
import type { ChatContext, ChatItem } from './reply-to-chat';

export type ChatMessage = typeof chatMessages.$inferSelect;
export type ExecutedToolCall = ToolCall & ToolOutcome;

const HISTORY_LENGTH = 30;
const RECENT_ITEMS = 20;

export class ChatMessageNotFoundError extends Error {
  readonly retryable = false;
  readonly code = 'chat_message_not_found';

  constructor(messageId: string) {
    super(`Chat message ${messageId} not found`);
    this.name = 'ChatMessageNotFoundError';
  }
}

export async function insertChatMessage(
  db: Database,
  values: Pick<typeof chatMessages.$inferInsert, 'brandId' | 'userId' | 'role' | 'content' | 'toolCalls' | 'replyToId'>,
): Promise<ChatMessage | undefined> {
  const [message] = await db.insert(chatMessages).values(values).onConflictDoNothing().returning();
  return message;
}

export async function findUserChatMessage(db: Database, brandId: string, messageId: string): Promise<ChatMessage | undefined> {
  const [message] = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.brandId, brandId), eq(chatMessages.role, 'user')));
  return message;
}

export async function hasChatReply(db: Database, messageId: string): Promise<boolean> {
  const [reply] = await db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.replyToId, messageId));
  return reply !== undefined;
}

export async function listRecentChatMessages(
  db: Database,
  brandId: string,
  limit: number,
  untilMessageId?: string,
): Promise<ChatMessage[]> {
  const untilMessage = untilMessageId
    ? sql`${chatMessages.createdAt} <= (select created_at from chat_messages where id = ${untilMessageId})`
    : undefined;
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.brandId, brandId), untilMessage))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

async function listRecentChatItems(db: Database, brandId: string): Promise<ChatItem[]> {
  const rows = await db
    .select({
      id: contentItems.id,
      channel: contentItems.channel,
      format: contentItems.format,
      status: contentItems.status,
      angle: contentItems.angle,
      copy: itemVersions.copy,
    })
    .from(contentItems)
    .leftJoin(itemVersions, eq(itemVersions.id, contentItems.currentVersionId))
    .where(eq(contentItems.brandId, brandId))
    .orderBy(desc(contentItems.createdAt))
    .limit(RECENT_ITEMS);
  return rows.map(({ angle, copy, ...item }) => ({ ...item, title: copyTitle(copy) ?? angle }));
}

export async function loadChatContext(db: Database, message: ChatMessage): Promise<ChatContext> {
  const { brandId } = message;
  const stored = await getBrandDna(db, brandId);
  if (!stored) throw new BrandNotReadyError(brandId);
  const strategyId = await findLatestStrategyId(db, brandId);
  const strategy = strategyId ? await findStrategy(db, strategyId) : undefined;
  const history = await listRecentChatMessages(db, brandId, HISTORY_LENGTH, message.id);
  return {
    dna: stored.dna,
    strategy: strategy && {
      goal: strategy.goal,
      pillars: strategyDocumentSchema.parse(strategy.document).pillars,
    },
    recentItems: await listRecentChatItems(db, brandId),
    history: history.map(({ role, content }) => ({ role, content })),
  };
}
