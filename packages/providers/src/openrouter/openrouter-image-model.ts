import { ProviderError } from '../provider-error';
import type { ImageModel, ImageRequest, ImageResult } from '../types';
import type { OpenRouterClient } from './openrouter-client';
import { readUsage, type WireUsage } from './usage';

type ImageResponse = {
  choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
  usage?: WireUsage;
};

const dataUrlPattern = /^data:([^;,]+);base64,(.*)$/s;

export function createOpenRouterImageModel(client: OpenRouterClient): ImageModel {
  return {
    async generate(request: ImageRequest): Promise<ImageResult> {
      const response = await client.post<ImageResponse>(
        '/chat/completions',
        {
          model: request.model,
          messages: [{ role: 'user', content: request.prompt }],
          modalities: ['image', 'text'],
          image_config: { aspect_ratio: request.aspectRatio },
        },
        request.signal,
      );
      const url = response.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const match = typeof url === 'string' ? dataUrlPattern.exec(url) : null;
      if (!match?.[1] || match[2] === undefined) {
        throw new ProviderError('invalid_output', 'Response contains no image');
      }
      return {
        bytes: new Uint8Array(Buffer.from(match[2], 'base64')),
        mimeType: match[1],
        usage: readUsage(response.usage),
      };
    },
  };
}
