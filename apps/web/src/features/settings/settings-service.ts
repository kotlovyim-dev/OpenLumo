import { z } from 'zod';
import {
  getModelSetting,
  readSecret,
  resolveCatalog,
  saveModelSetting,
  saveSecret,
  verifyApiKey,
  type Config,
  type ModelCapability,
} from '@openlumo/core';
import type { Database } from '@openlumo/db';

export type SettingsContext = { db: Database; config: Config; user: { role: string } };

export type ModelOption = { id: string; name: string; pricePerMillionInputTokens?: number };

export type SettingsResult = { ok: true } | { ok: false; error: string };

const capabilitySchema = z.enum(['brain', 'image']);
const apiKeySchema = z.string().trim().min(1);
const modelIdSchema = z.string().trim().min(1);

const outputModality = { brain: 'text', image: 'image' } as const;

function isAdmin(context: SettingsContext) {
  return context.user.role === 'admin';
}

export async function saveApiKey(context: SettingsContext, formData: FormData): Promise<SettingsResult> {
  if (!isAdmin(context)) return { ok: false, error: 'forbidden' };
  const parsed = apiKeySchema.safeParse(formData.get('apiKey'));
  if (!parsed.success) return { ok: false, error: 'invalid_key' };
  if (!(await verifyApiKey(parsed.data, context.config))) return { ok: false, error: 'unauthorized' };
  await saveSecret(context.db, 'openrouter_api_key', parsed.data, context.config.appSecret);
  return { ok: true };
}

type ModelListResult = { ok: true; models: ModelOption[] } | { ok: false; error: string };

async function loadModels(context: SettingsContext, capability: ModelCapability): Promise<ModelListResult> {
  const key = await readSecret(context.db, 'openrouter_api_key', context.config.appSecret);
  if (!key) return { ok: false, error: 'no_api_key' };
  try {
    const catalog = await resolveCatalog(context.db, context.config);
    const models = (await catalog.listModels())
      .filter((model) => model.outputModalities.includes(outputModality[capability]))
      .map(({ id, name, pricePerMillionInputTokens }) =>
        pricePerMillionInputTokens === undefined ? { id, name } : { id, name, pricePerMillionInputTokens },
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, models };
  } catch {
    return { ok: false, error: 'catalog_unavailable' };
  }
}

export async function listAvailableModels(
  context: SettingsContext,
  capability: ModelCapability,
): Promise<ModelListResult> {
  const parsed = capabilitySchema.safeParse(capability);
  if (!parsed.success) return { ok: false, error: 'invalid_capability' };
  return loadModels(context, parsed.data);
}

export async function saveModelChoice(
  context: SettingsContext,
  capability: ModelCapability,
  modelId: string,
): Promise<SettingsResult> {
  if (!isAdmin(context)) return { ok: false, error: 'forbidden' };
  const parsedCapability = capabilitySchema.safeParse(capability);
  const parsedModel = modelIdSchema.safeParse(modelId);
  if (!parsedCapability.success || !parsedModel.success) return { ok: false, error: 'invalid_model' };
  const available = await loadModels(context, parsedCapability.data);
  if (!available.ok) return available;
  if (!available.models.some((model) => model.id === parsedModel.data)) return { ok: false, error: 'unknown_model' };
  await saveModelSetting(context.db, {
    capability: parsedCapability.data,
    provider: 'openrouter',
    model: parsedModel.data,
    params: {},
  });
  return { ok: true };
}

export async function getStoredKeyHint(context: Pick<SettingsContext, 'db' | 'config'>): Promise<string | null> {
  const key = await readSecret(context.db, 'openrouter_api_key', context.config.appSecret);
  if (!key) return null;
  return key.length > 8 ? `••••${key.slice(-4)}` : '••••';
}

export async function getSetupStatus(context: Pick<SettingsContext, 'db' | 'config'>) {
  const [key, brain, image] = await Promise.all([
    readSecret(context.db, 'openrouter_api_key', context.config.appSecret),
    getModelSetting(context.db, 'brain'),
    getModelSetting(context.db, 'image'),
  ]);
  const hasKey = key !== null;
  return {
    hasKey,
    brain: brain?.model ?? null,
    image: image?.model ?? null,
    complete: hasKey && brain !== null && image !== null,
  };
}
