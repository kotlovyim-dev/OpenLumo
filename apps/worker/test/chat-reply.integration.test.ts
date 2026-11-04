import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  type Config,
  type JobContext,
  type Queue,
  createAssetStorage,
  createBrand,
  createPartialBrandDna,
  createQueue,
  insertChatMessage,
  loadConfig,
  saveBrandDna,
} from '@openlumo/core';
import { FakeProvider, type TextRequest, type TextResult } from '@openlumo/providers';
import { chatMessages, contentItems, jobRuns, users, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createChatReplyJob } from '../src/jobs/chat-reply';

describe('chat.reply', () => {
  let db: Database;
  let drop: () => Promise<void>;
  let storageDirectory: string;
  let config: Config;
  let boss: Queue;
  const progress: string[] = [];
  const usage = { inputTokens: 3, outputTokens: 1, costUsd: 0.01 };
  const recordUsage = vi.fn(async () => {});

  const context: JobContext = {
    runId: 'run',
    signal: new AbortController().signal,
    reportProgress: async (step) => {
      progress.push(step);
    },
    recordUsage,
    enqueue: async () => 'queued',
  };

  beforeAll(async () => {
    let url: string;
    ({ db, drop, url } = await createTestDatabase());
    storageDirectory = await mkdtemp(path.join(tmpdir(), 'openlumo-chat-'));
    config = loadConfig({
      DATABASE_URL: 'postgres://unused',
      APP_SECRET: 'x'.repeat(32),
      PUBLIC_URL: 'http://localhost:3000',
      OPENLUMO_TEST_PROVIDERS: 'fake',
    });
    boss = await createQueue(url, { createQueues: true });
    await db.insert(users).values({ id: 'u1', name: 'U', email: 'u@example.com' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await boss.stop({ graceful: false });
    await rm(storageDirectory, { recursive: true, force: true });
    await drop();
  });

  const job = () => createChatReplyJob({ db, config, storage: createAssetStorage(storageDirectory), boss });

  async function brandWithMessage(content: string) {
    const brand = await createBrand(db, { name: 'Acme', createdBy: 'u1' });
    await saveBrandDna(db, brand.id, createPartialBrandDna({ name: 'Acme', palette: [] }));
    const message = await insertChatMessage(db, { brandId: brand.id, userId: 'u1', role: 'user', content });
    return { brandId: brand.id, messageId: message!.id };
  }

  function scriptBrain(respond: (request: TextRequest) => string | TextResult) {
    const requests: TextRequest[] = [];
    vi.spyOn(FakeProvider.prototype, 'complete').mockImplementation(async (request) => {
      requests.push(request);
      const response = respond(request);
      return typeof response === 'string' ? { text: response, toolCalls: [], usage } : response;
    });
    return requests;
  }

  it('creates a draft through create_draft and stores the assistant reply', async () => {
    const payload = await brandWithMessage('Make an Instagram post about our launch.');
    const requests = scriptBrain((request) => {
      const tool = request.messages.find((message) => message.role === 'tool');
      if (tool) return `Started it. ${tool.content}`;
      return {
        text: '',
        toolCalls: [{ id: 'c1', name: 'create_draft', arguments: { channel: 'instagram', format: 'social_post', angle: 'Launch day' } }],
        usage,
      };
    });

    await job().run(payload, context);

    const items = await db.select().from(contentItems).where(eq(contentItems.brandId, payload.brandId));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ channel: 'instagram', format: 'social_post', status: 'in_review', scheduledAt: null });
    const itemId = items[0]!.id;

    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.itemId, itemId));
    expect(run).toMatchObject({ type: 'item.generate', idempotencyKey: `generate:${itemId}:1` });
    expect((await boss.getJobById<Record<string, unknown>>('item.generate', run!.id))?.data).toMatchObject({
      instruction: 'Launch day',
    });

    const [reply] = await db.select().from(chatMessages).where(eq(chatMessages.replyToId, payload.messageId));
    expect(reply).toMatchObject({ brandId: payload.brandId, userId: 'u1', role: 'assistant' });
    expect(reply!.content).toContain(itemId);
    expect(reply!.toolCalls).toEqual([
      expect.objectContaining({ id: 'c1', name: 'create_draft', itemId, result: expect.stringContaining(itemId) }),
    ]);
    expect(progress).toContain('Thinking');
    expect(recordUsage).toHaveBeenCalledWith({ inputTokens: 6, outputTokens: 2, costUsd: 0.02 });

    expect(requests[0]!.messages[0]!.role).toBe('system');
    expect(requests[0]!.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Make an Instagram post about our launch.',
    });
  });

  it('does not call the model again when the message already has a reply', async () => {
    const payload = await brandWithMessage('Hello');
    const requests = scriptBrain(() => 'Hi there');
    await job().run(payload, context);
    await job().run(payload, context);

    expect(requests).toHaveLength(1);
    const replies = await db.select().from(chatMessages).where(eq(chatMessages.replyToId, payload.messageId));
    expect(replies.map((reply) => reply.content)).toEqual(['Hi there']);
  });

  it('regenerates only items of the same brand', async () => {
    const payload = await brandWithMessage('Redo the posts.');
    const other = await brandWithMessage('Other brand');
    const [foreign] = await db
      .insert(contentItems)
      .values({ brandId: other.brandId, channel: 'x', format: 'social_post', status: 'in_review' })
      .returning();
    const [own] = await db
      .insert(contentItems)
      .values({ brandId: payload.brandId, channel: 'x', format: 'social_post', status: 'in_review' })
      .returning();
    scriptBrain((request) => {
      const tools = request.messages.filter((message) => message.role === 'tool');
      if (tools.length > 0) return tools.map((message) => message.content).join(' | ');
      return {
        text: '',
        toolCalls: [foreign!, own!].map((item, index) => ({
          id: `r${index}`,
          name: 'regenerate_item',
          arguments: { itemId: item.id, scope: 'copy', feedback: 'Shorter please' },
        })),
        usage,
      };
    });

    await job().run(payload, context);

    const runs = await db.select().from(jobRuns).where(eq(jobRuns.type, 'item.regenerate'));
    expect(runs.map((run) => run.itemId)).toEqual([own!.id]);
    const [reply] = await db.select().from(chatMessages).where(eq(chatMessages.replyToId, payload.messageId));
    expect(reply!.content).toContain(`Item ${foreign!.id} was not found.`);
  });

  it('fails without retrying when the message belongs to another brand', async () => {
    const payload = await brandWithMessage('Hello');
    const other = await brandWithMessage('Other');
    await expect(job().run({ brandId: other.brandId, messageId: payload.messageId }, context)).rejects.toMatchObject({
      code: 'chat_message_not_found',
      retryable: false,
    });
  });
});
