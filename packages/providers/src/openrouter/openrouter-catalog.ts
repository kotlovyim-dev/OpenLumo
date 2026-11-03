import type { ModelCatalog, ModelInfo } from '../types';
import type { OpenRouterClient } from './openrouter-client';

type WireModel = {
  id: string;
  name: string;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string };
};

function toModelInfo(model: WireModel): ModelInfo {
  const info: ModelInfo = {
    id: model.id,
    name: model.name,
    outputModalities: model.architecture?.output_modalities ?? [],
  };
  const promptPrice = Number(model.pricing?.prompt);
  if (model.pricing?.prompt !== undefined && Number.isFinite(promptPrice)) {
    info.pricePerMillionInputTokens = promptPrice * 1_000_000;
  }
  return info;
}

export function createOpenRouterCatalog(client: OpenRouterClient): ModelCatalog {
  return {
    async listModels() {
      const response = await client.get<{ data: WireModel[] }>('/models');
      return response.data.map(toModelInfo);
    },
  };
}
