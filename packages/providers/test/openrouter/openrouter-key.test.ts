import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { jsonResponse, stubFetch } from './stub-fetch';

describe('OpenRouter key verification', () => {
  it('returns true for a valid key and calls /key with the bearer token', async () => {
    const { fetchImplementation, calls } = stubFetch(() => jsonResponse({ data: { label: 'k' } }));
    expect(await createOpenRouter('sk-or-1', fetchImplementation).verifyKey()).toBe(true);
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/key');
    expect(calls[0]?.init.method).toBe('GET');
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-1');
  });

  it('returns false for a 401', async () => {
    const { fetchImplementation } = stubFetch(() => jsonResponse({ error: { message: 'bad' } }, 401));
    expect(await createOpenRouter('bad', fetchImplementation).verifyKey()).toBe(false);
  });

  it('rethrows other provider errors', async () => {
    const { fetchImplementation } = stubFetch(() => jsonResponse({ error: { message: 'down' } }, 500));
    await expect(createOpenRouter('k', fetchImplementation).verifyKey()).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
