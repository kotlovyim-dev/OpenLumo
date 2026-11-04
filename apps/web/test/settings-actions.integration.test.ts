import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig, readSecret, verifyApiKey } from '@openlumo/core';
import { secrets } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import {
  getSetupStatus,
  getStoredKeyHint,
  listAvailableModels,
  saveApiKey,
  saveModelChoice,
  type SettingsContext,
} from '../src/features/settings/settings-service';

vi.mock('@openlumo/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openlumo/core')>();
  return { ...actual, verifyApiKey: vi.fn(actual.verifyApiKey) };
});

const plaintext = 'sk-or-v1-supersecretvalue1234';

function keyForm(value: string) {
  const form = new FormData();
  form.set('apiKey', value);
  return form;
}

describe('settings actions', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let admin: SettingsContext;
  let member: SettingsContext;

  beforeAll(async () => {
    database = await createTestDatabase();
    const config = loadConfig({
      ...process.env,
      DATABASE_URL: database.url,
      APP_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      PUBLIC_URL: 'http://localhost:3000',
      OPENLUMO_TEST_PROVIDERS: 'fake',
    });
    admin = { db: database.db, config, user: { role: 'admin' } };
    member = { db: database.db, config, user: { role: 'member' } };
  });

  afterAll(async () => {
    await database.drop();
  });

  it('rejects a non-admin saving a key', async () => {
    expect(await saveApiKey(member, keyForm(plaintext))).toEqual({ ok: false, error: 'forbidden' });
    expect(await database.db.select().from(secrets)).toHaveLength(0);
  });

  it('does not store a key that fails verification', async () => {
    vi.mocked(verifyApiKey).mockResolvedValueOnce(false);
    expect(await saveApiKey(admin, keyForm('bad-key'))).toEqual({ ok: false, error: 'unauthorized' });
    expect(await database.db.select().from(secrets)).toHaveLength(0);
  });

  it('rejects an empty key', async () => {
    const result = await saveApiKey(admin, keyForm(''));
    expect(result.ok).toBe(false);
    expect(await database.db.select().from(secrets)).toHaveLength(0);
  });

  it('reports no_api_key when listing models before a key exists', async () => {
    expect(await listAvailableModels(admin, 'brain')).toEqual({ ok: false, error: 'no_api_key' });
  });

  it('stores a valid key encrypted', async () => {
    expect(await saveApiKey(admin, keyForm(plaintext))).toEqual({ ok: true });
    const rows = await database.db.select().from(secrets);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(plaintext);
    expect(await readSecret(database.db, 'openrouter_api_key', admin.config.appSecret)).toBe(plaintext);
    expect(await getStoredKeyHint(admin)).toBe('••••1234');
  });

  it('lists models filtered by output modality', async () => {
    const brain = await listAvailableModels(member, 'brain');
    const image = await listAvailableModels(member, 'image');
    expect(brain.ok && brain.models.map((model) => model.id)).toEqual(['fake/text']);
    expect(image.ok && image.models.map((model) => model.id)).toEqual(['fake/image']);
  });

  it('saves model choices for admins only and reports setup completion', async () => {
    expect(await saveModelChoice(member, 'brain', 'fake/text')).toEqual({ ok: false, error: 'forbidden' });
    expect((await getSetupStatus(admin)).complete).toBe(false);
    expect(await saveModelChoice(admin, 'brain', 'fake/text')).toEqual({ ok: true });
    expect(await saveModelChoice(admin, 'image', 'fake/image')).toEqual({ ok: true });
    expect(await getSetupStatus(admin)).toEqual({ hasKey: true, brain: 'fake/text', image: 'fake/image', complete: true });
  });
});
