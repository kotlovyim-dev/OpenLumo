import { eq } from 'drizzle-orm';
import { modelSettings, type Database } from '@openlumo/db';

export type ModelCapability = 'brain' | 'image';

export type ModelSetting = {
  capability: ModelCapability;
  provider: 'openrouter';
  model: string;
  params: Record<string, unknown>;
};

export async function getModelSetting(db: Database, capability: ModelCapability): Promise<ModelSetting | null> {
  const [row] = await db.select().from(modelSettings).where(eq(modelSettings.capability, capability));
  if (!row) return null;
  return {
    capability,
    provider: 'openrouter',
    model: row.model,
    params: (row.params ?? {}) as Record<string, unknown>,
  };
}

export async function saveModelSetting(db: Database, setting: ModelSetting): Promise<void> {
  const values = { provider: setting.provider, model: setting.model, params: setting.params };
  await db
    .insert(modelSettings)
    .values({ capability: setting.capability, ...values })
    .onConflictDoUpdate({ target: modelSettings.capability, set: values });
}
