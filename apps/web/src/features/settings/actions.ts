'use server';

import type { ModelCapability } from '@openlumo/core';
import { getServerContext } from '@/lib/server-context';
import * as service from './settings-service';

async function settingsContext() {
  const { db, config, user } = await getServerContext();
  return { db, config, user };
}

export async function saveApiKey(formData: FormData) {
  return service.saveApiKey(await settingsContext(), formData);
}

export async function listAvailableModels(capability: ModelCapability) {
  return service.listAvailableModels(await settingsContext(), capability);
}

export async function saveModelChoice(capability: ModelCapability, modelId: string) {
  return service.saveModelChoice(await settingsContext(), capability, modelId);
}
