import type { ImageModel, LanguageModel, ModelCatalog } from '../types';
import { createOpenRouterCatalog } from './openrouter-catalog';
import { createOpenRouterClient } from './openrouter-client';
import { createOpenRouterImageModel } from './openrouter-image-model';
import { createOpenRouterLanguageModel } from './openrouter-language-model';

export function createOpenRouter(
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
): LanguageModel & ImageModel & ModelCatalog {
  const client = createOpenRouterClient(apiKey, fetchImplementation);
  return {
    ...createOpenRouterLanguageModel(client),
    ...createOpenRouterImageModel(client),
    ...createOpenRouterCatalog(client),
  };
}
