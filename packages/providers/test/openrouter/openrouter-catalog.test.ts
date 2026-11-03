import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { jsonResponse, stubFetch } from './stub-fetch';

describe('OpenRouter catalog', () => {
  it('maps models with modalities and per-million prompt price', async () => {
    const { fetchImplementation, calls } = stubFetch(() =>
      jsonResponse({
        data: [
          {
            id: 'a/b',
            name: 'AB',
            architecture: { output_modalities: ['text'] },
            pricing: { prompt: '0.000003' },
          },
          { id: 'c/d', name: 'CD', architecture: { output_modalities: ['image', 'text'] } },
        ],
      }),
    );
    const models = await createOpenRouter('k', fetchImplementation).listModels();
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/models');
    expect(calls[0]?.init.method).toBe('GET');
    expect(models).toEqual([
      { id: 'a/b', name: 'AB', outputModalities: ['text'], pricePerMillionInputTokens: 3 },
      { id: 'c/d', name: 'CD', outputModalities: ['image', 'text'] },
    ]);
  });
});
