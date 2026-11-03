import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { FakeProvider, ProviderError } from '@openlumo/providers';
import { loadConfig, type Config } from '../../src/config';
import { getModelSetting, saveModelSetting } from '../../src/models/model-settings';
import {
  MissingModelSettingError,
  resolveCatalog,
  resolveModels,
  verifyApiKey,
} from '../../src/models/registry';
import { saveSecret } from '../../src/secrets/secret-store';

const baseEnv = {
  DATABASE_URL: 'postgres://unused',
  APP_SECRET: 's'.repeat(32),
  PUBLIC_URL: 'http://localhost:3000',
};
const realConfig: Config = loadConfig(baseEnv);
const fakeConfig: Config = loadConfig({ ...baseEnv, OPENLUMO_TEST_PROVIDERS: 'fake' });

describe('model registry', () => {
  let db: Database;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
  });

  afterAll(async () => {
    await drop();
  });

  it('throws unauthorized without a stored key', async () => {
    await expect(resolveModels(db, realConfig)).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(resolveCatalog(db, realConfig)).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws MissingModelSettingError for an unset image model', async () => {
    await saveSecret(db, 'openrouter_api_key', 'sk-or-1', realConfig.appSecret);
    await saveModelSetting(db, { capability: 'brain', provider: 'openrouter', model: 'a/brain', params: {} });
    const error = await resolveModels(db, realConfig).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MissingModelSettingError);
    expect(error).toMatchObject({ capability: 'image', retryable: false, code: 'model_not_configured' });
  });

  it('resolves OpenRouter-backed models when key and settings exist', async () => {
    await saveModelSetting(db, { capability: 'image', provider: 'openrouter', model: 'a/image', params: { x: 1 } });
    const models = await resolveModels(db, realConfig);
    expect(models.brain.modelId).toBe('a/brain');
    expect(models.image.modelId).toBe('a/image');
    expect(models.brain.model).not.toBeInstanceOf(FakeProvider);
    expect(await getModelSetting(db, 'image')).toMatchObject({ params: { x: 1 } });
  });

  it('replaces an existing setting', async () => {
    await saveModelSetting(db, { capability: 'brain', provider: 'openrouter', model: 'b/brain', params: {} });
    expect((await getModelSetting(db, 'brain'))?.model).toBe('b/brain');
  });
});

describe('fake providers', () => {
  const db = undefined as unknown as Database;

  it('resolves fakes without key or settings', async () => {
    const models = await resolveModels(db, fakeConfig);
    expect(models.brain.modelId).toBe('fake/text');
    const reply = await models.brain.model.complete({ model: 'fake/text', messages: [] });
    expect(reply.text).toBe('ok');
    expect(await (await resolveCatalog(db, fakeConfig)).listModels()).not.toHaveLength(0);
  });

  it('verifies any non-empty key', async () => {
    expect(await verifyApiKey('sk-anything', fakeConfig)).toBe(true);
    expect(await verifyApiKey('', fakeConfig)).toBe(false);
  });

  it('fails exactly once per prompt containing #fail-once', async () => {
    const { image } = await resolveModels(db, fakeConfig);
    const request = { model: 'fake/image', prompt: 'a logo #fail-once', aspectRatio: '1:1' as const };
    await expect(image.model.generate(request)).rejects.toMatchObject({ code: 'invalid_output' });
    expect((await image.model.generate(request)).mimeType).toBe('image/png');
    await expect(image.model.generate({ ...request, prompt: 'another #fail-once' })).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect((await image.model.generate({ ...request, prompt: 'plain' })).mimeType).toBe('image/png');
  });
});
