import { ProviderError } from '../provider-error';
import type {
  ImageModel,
  ImageRequest,
  ImageResult,
  LanguageModel,
  ModelCatalog,
  ModelInfo,
  TextRequest,
  TextResult,
  Usage,
} from '../types';

const onePixelPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

const zeroUsage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

type TextResponse = string | TextResult | ProviderError;
type ImageResponse = Uint8Array | ProviderError;

type FakeProviderOptions = {
  textResponses?: TextResponse[];
  respond?: (request: TextRequest) => TextResponse;
  image?: ImageResponse | ((request: ImageRequest) => ImageResponse);
};

const models: ModelInfo[] = [
  { id: 'fake/text', name: 'Fake Text', outputModalities: ['text'] },
  { id: 'fake/image', name: 'Fake Image', outputModalities: ['image'] },
];

export class FakeProvider implements LanguageModel, ImageModel, ModelCatalog {
  readonly requests: Array<TextRequest | ImageRequest> = [];
  private readonly options: FakeProviderOptions;
  private textCalls = 0;

  constructor(options: FakeProviderOptions = {}) {
    this.options = options;
  }

  async complete(request: TextRequest): Promise<TextResult> {
    request.signal?.throwIfAborted();
    this.requests.push(request);
    const { respond, textResponses = [''] } = this.options;
    const response =
      respond?.(request) ?? textResponses[Math.min(this.textCalls, textResponses.length - 1)] ?? '';
    this.textCalls += 1;
    if (response instanceof ProviderError) throw response;
    return typeof response === 'string'
      ? { text: response, toolCalls: [], usage: zeroUsage }
      : response;
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    request.signal?.throwIfAborted();
    this.requests.push(request);
    const { image = onePixelPng } = this.options;
    const response = typeof image === 'function' ? image(request) : image;
    if (response instanceof ProviderError) throw response;
    return { bytes: response, mimeType: 'image/png', usage: zeroUsage };
  }

  async listModels(): Promise<ModelInfo[]> {
    return models;
  }
}
