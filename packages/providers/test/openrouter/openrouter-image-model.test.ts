import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { imageCompletion, jsonResponse, pngBase64, stubFetch } from './stub-fetch';

const request = { model: 'img/m', prompt: 'a lumo', aspectRatio: '16:9' as const };

describe('OpenRouter image model', () => {
  it('requests image modalities with the aspect ratio and decodes the data URL', async () => {
    const { fetchImplementation, calls } = stubFetch(() => jsonResponse(imageCompletion));
    const result = await createOpenRouter('k', fetchImplementation).generate(request);
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0]?.body).toEqual({
      model: 'img/m',
      messages: [{ role: 'user', content: 'a lumo' }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: '16:9' },
    });
    expect(result.mimeType).toBe('image/png');
    expect(Buffer.from(result.bytes).toString('base64')).toBe(pngBase64);
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 0, costUsd: 0.04 });
  });

  it('throws invalid_output when the image response has no images', async () => {
    const { fetchImplementation } = stubFetch(() =>
      jsonResponse({ choices: [{ message: { role: 'assistant', content: 'sorry' } }] }),
    );
    await expect(createOpenRouter('k', fetchImplementation).generate(request)).rejects.toMatchObject(
      { code: 'invalid_output' },
    );
  });
});
