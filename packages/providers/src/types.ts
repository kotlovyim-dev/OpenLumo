export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
};

export type ToolDefinition = { name: string; description: string; parameters: object };

export type ToolCall = { id: string; name: string; arguments: unknown };

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };

export type TextRequest = {
  model: string;
  messages: Message[];
  jsonSchema?: { name: string; schema: object };
  tools?: ToolDefinition[];
  signal?: AbortSignal;
};

export type TextResult = { text: string; toolCalls: ToolCall[]; usage: Usage };

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';

export type ImageRequest = {
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  signal?: AbortSignal;
};

export type ImageResult = { bytes: Uint8Array; mimeType: string; usage: Usage };

export type ModelInfo = {
  id: string;
  name: string;
  outputModalities: string[];
  pricePerMillionInputTokens?: number;
};

export interface LanguageModel {
  complete(request: TextRequest): Promise<TextResult>;
}

export interface ImageModel {
  generate(request: ImageRequest): Promise<ImageResult>;
}

export type VideoModel = object;

export type AudioModel = object;

export interface ModelCatalog {
  listModels(): Promise<ModelInfo[]>;
}
