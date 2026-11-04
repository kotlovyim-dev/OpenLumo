import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createQueue, type JobEvent, type Queue } from '@openlumo/core';
import { brandMembers, brands, jobRuns, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createBrandForUser, inviteMember } from '../src/features/brands/brand-service';
import { openBrandEventStream } from '../src/features/brands/events-stream';

function brandForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe('brand actions', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let boss: Queue;

  beforeAll(async () => {
    database = await createTestDatabase();
    boss = await createQueue(database.url, { createQueues: true, supervise: false, schedule: false });
    for (const id of ['owner', 'other', 'invitee']) {
      await database.db.insert(users).values({ id, name: id, email: `${id}@example.com` });
    }
  });

  afterAll(async () => {
    await boss.stop();
    await database.drop();
  });

  function runsOf(brandId: string) {
    return database.db.select().from(jobRuns).where(eq(jobRuns.brandId, brandId));
  }

  async function statusOf(brandId: string) {
    const [brand] = await database.db.select().from(brands).where(eq(brands.id, brandId));
    return brand?.status;
  }

  it('creates a brand and enqueues exactly one crawl when a URL is given', async () => {
    const result = await createBrandForUser(
      { db: database.db, boss, user: { id: 'owner' } },
      brandForm({ name: 'Acme', url: 'https://acme.example' }),
    );
    if (!result.ok) throw new Error('expected success');
    const runs = await runsOf(result.brandId);
    expect(runs.map((run) => run.type)).toEqual(['brand.crawl']);
    expect(runs[0]?.idempotencyKey).toBe(`crawl:${result.brandId}`);
    expect(await statusOf(result.brandId)).toBe('crawling');
  });

  it('creates a manual brand without a crawl when the URL is empty', async () => {
    const result = await createBrandForUser(
      { db: database.db, boss, user: { id: 'owner' } },
      brandForm({ name: 'Manual', url: '' }),
    );
    if (!result.ok) throw new Error('expected success');
    expect(await runsOf(result.brandId)).toHaveLength(0);
    expect(await statusOf(result.brandId)).toBe('needs_input');
  });

  it('rejects non-http URLs and over-long URLs', async () => {
    const context = { db: database.db, boss, user: { id: 'owner' } };
    const badUrls = ['ftp://acme.example', 'javascript:alert(1)', 'not a url', `https://acme.example/${'a'.repeat(2048)}`];
    for (const url of badUrls) {
      const result = await createBrandForUser(context, brandForm({ name: 'Bad', url }));
      expect(result).toMatchObject({ ok: false, fieldErrors: { url: expect.any(String) } });
    }
  });

  describe('invites and events', () => {
    let brandId: string;

    beforeAll(async () => {
      const result = await createBrandForUser(
        { db: database.db, boss, user: { id: 'owner' } },
        brandForm({ name: 'Team', url: '' }),
      );
      if (!result.ok) throw new Error('expected success');
      brandId = result.brandId;
    });

    it('lets an owner invite an existing user', async () => {
      const owner = { db: database.db, user: { id: 'owner' } };
      expect(await inviteMember(owner, brandId, 'Invitee@Example.com', 'editor')).toEqual({ ok: true });
      const members = await database.db.select().from(brandMembers).where(eq(brandMembers.brandId, brandId));
      expect(members.find((member) => member.userId === 'invitee')?.role).toBe('editor');
    });

    it('reports an unknown email', async () => {
      const owner = { db: database.db, user: { id: 'owner' } };
      expect(await inviteMember(owner, brandId, 'nobody@example.com', 'viewer')).toEqual({
        ok: false,
        error: 'user_not_found',
      });
    });

    it('refuses invites from non-owners', async () => {
      const editor = { db: database.db, user: { id: 'invitee' } };
      expect(await inviteMember(editor, brandId, 'other@example.com', 'viewer')).toEqual({
        ok: false,
        error: 'forbidden',
      });
    });

    it('returns 404 from the events stream for a non-member', async () => {
      const response = await openBrandEventStream(
        { db: database.db, user: { id: 'other' }, subscribe: () => () => {} },
        brandId,
        new AbortController().signal,
      );
      expect(response.status).toBe(404);
    });

    it('streams events to a member and unsubscribes on abort', async () => {
      let emit: (event: JobEvent) => void = () => {};
      let unsubscribed = false;
      const subscribe = (_brandId: string, listener: (event: JobEvent) => void) => {
        emit = listener;
        return () => {
          unsubscribed = true;
        };
      };
      const abort = new AbortController();
      const response = await openBrandEventStream(
        { db: database.db, user: { id: 'invitee' }, subscribe },
        brandId,
        abort.signal,
      );
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');

      const event: JobEvent = { runId: 'r', brandId, type: 'brand.crawl', status: 'running', step: 'Reading your site' };
      emit(event);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('data:')) text += decoder.decode((await reader.read()).value);
      expect(text).toContain(`data: ${JSON.stringify(event)}\n\n`);

      abort.abort();
      expect(unsubscribed).toBe(true);
    });
  });
});
