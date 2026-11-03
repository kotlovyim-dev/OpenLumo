import type { ImageModel, LanguageModel, ModelCatalog } from '../types';
import { createOpenRouterCatalog } from './openrouter-catalog';
import { createOpenRouterClient } from './openrouter-client';
import { createOpenRouterImageModel } from './openrouter-image-model';
import { createOpenRouterKeyVerifier } from './openrouter-key';
import { createOpenRouterLanguageModel } from './openrouter-language-model';

export type OpenRouterProvider = LanguageModel &
  ImageModel &
  ModelCatalog & { verifyKey(): Promise<boolean> };

export function createOpenRouter(
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
): OpenRouterProvider {
  const client = createOpenRouterClient(apiKey, fetchImplementation);
  return {
    ...createOpenRouterLanguageModel(client),
    ...createOpenRouterImageModel(client),
    ...createOpenRouterCatalog(client),
    ...createOpenRouterKeyVerifier(client),
  };
}
