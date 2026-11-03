import type { Database } from '@openlumo/db';
import {
  FakeProvider,
  ProviderError,
  type ImageModel,
  type LanguageModel,
  type ModelCatalog,
} from '@openlumo/providers';
import { createOpenRouter } from '@openlumo/providers/openrouter';
import type { Config } from '../config';
import { readSecret } from '../secrets/secret-store';
import { defaultFakeReply, fakeResponses } from '../../test-fixtures/fake-responses';
import { getModelSetting, type ModelCapability } from './model-settings';

export type ResolvedModels = {
  brain: { model: LanguageModel; modelId: string };
  image: { model: ImageModel; modelId: string };
  catalog: ModelCatalog;
};

export class MissingModelSettingError extends Error {
  readonly retryable = false;
  readonly code = 'model_not_configured';
  readonly capability: ModelCapability;

  constructor(capability: ModelCapability) {
    super(`No ${capability} model is configured`);
    this.name = 'MissingModelSettingError';
    this.capability = capability;
  }
}

const failedOncePrompts = new Set<string>();

function createFakeBrain(): FakeProvider {
  return new FakeProvider({
    respond: (request) => {
      const fixture = fakeResponses[request.jsonSchema?.name ?? ''];
      return fixture ? JSON.stringify(fixture(request)) : defaultFakeReply;
    },
  });
}

function createFakeImage(): ImageModel {
  const provider = new FakeProvider();
  return {
    async generate(request) {
      if (request.prompt.includes('#fail-once') && !failedOncePrompts.has(request.prompt)) {
        failedOncePrompts.add(request.prompt);
        throw new ProviderError('invalid_output', 'Scripted one-time image failure');
      }
      return provider.generate(request);
    },
  };
}

async function requireApiKey(db: Database, config: Config): Promise<string> {
  const apiKey = await readSecret(db, 'openrouter_api_key', config.appSecret);
  if (!apiKey) throw new ProviderError('unauthorized', 'No OpenRouter API key is stored');
  return apiKey;
}

async function requireModelId(db: Database, capability: ModelCapability): Promise<string> {
  const setting = await getModelSetting(db, capability);
  if (!setting) throw new MissingModelSettingError(capability);
  return setting.model;
}

export async function verifyApiKey(apiKey: string, config: Config): Promise<boolean> {
  if (config.testProviders === 'fake') return apiKey.length > 0;
  try {
    await createOpenRouter(apiKey).listModels();
    return true;
  } catch (error) {
    if (error instanceof ProviderError && error.code === 'unauthorized') return false;
    throw error;
  }
}

export async function resolveCatalog(db: Database, config: Config): Promise<ModelCatalog> {
  if (config.testProviders === 'fake') return new FakeProvider();
  return createOpenRouter(await requireApiKey(db, config));
}

export async function resolveModels(db: Database, config: Config): Promise<ResolvedModels> {
  if (config.testProviders === 'fake') {
    return {
      brain: { model: createFakeBrain(), modelId: 'fake/text' },
      image: { model: createFakeImage(), modelId: 'fake/image' },
      catalog: new FakeProvider(),
    };
  }
  const provider = createOpenRouter(await requireApiKey(db, config));
  return {
    brain: { model: provider, modelId: await requireModelId(db, 'brain') },
    image: { model: provider, modelId: await requireModelId(db, 'image') },
    catalog: provider,
  };
}
