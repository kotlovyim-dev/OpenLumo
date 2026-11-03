import type { Database } from '@openlumo/db';
import {
  ProviderError,
  type ImageModel,
  type LanguageModel,
  type ModelCatalog,
} from '@openlumo/providers';
import { createOpenRouter } from '@openlumo/providers/openrouter';
import type { Config } from '../config';
import { readSecret } from '../secrets/secret-store';
import { createFakeCatalog, createFakeModels } from './fake-models';
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
  return createOpenRouter(apiKey).verifyKey();
}

export async function resolveCatalog(db: Database, config: Config): Promise<ModelCatalog> {
  if (config.testProviders === 'fake') return createFakeCatalog();
  return createOpenRouter(await requireApiKey(db, config));
}

export async function resolveModels(db: Database, config: Config): Promise<ResolvedModels> {
  if (config.testProviders === 'fake') return createFakeModels();
  const provider = createOpenRouter(await requireApiKey(db, config));
  return {
    brain: { model: provider, modelId: await requireModelId(db, 'brain') },
    image: { model: provider, modelId: await requireModelId(db, 'image') },
    catalog: provider,
  };
}
