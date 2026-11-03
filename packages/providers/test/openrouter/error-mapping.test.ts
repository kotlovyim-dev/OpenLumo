import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { jsonResponse, stubFetch } from './stub-fetch';

const messages = [{ role: 'user' as const, content: 'hi' }];

function failWith(status: number, body: unknown = { error: { message: 'nope' } }) {
  const { fetchImplementation } = stubFetch(() => jsonResponse(body, status));
  return createOpenRouter('k', fetchImplementation).complete({ model: 'm', messages });
}

function rejectWith(error: unknown) {
  const fetchImplementation = (() => Promise.reject(error)) as typeof fetch;
  return createOpenRouter('k', fetchImplementation).complete({ model: 'm', messages });
}

describe('OpenRouter error mapping', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    [401, 'unauthorized', false],
    [403, 'unauthorized', false],
    [429, 'rate_limited', true],
    [408, 'timeout', true],
    [500, 'unavailable', true],
    [503, 'unavailable', true],
    [404, 'unavailable', false],
    [422, 'unavailable', false],
  ])('maps status %i to %s', async (status, code, retryable) => {
    await expect(failWith(status)).rejects.toMatchObject({ code, retryable });
  });

  it('maps a 400 mentioning moderation to content_policy', async () => {
    await expect(
      failWith(400, { error: { message: 'Content flagged by moderation' } }),
    ).rejects.toMatchObject({ code: 'content_policy', retryable: false });
  });

  it('maps a 400 mentioning policy to content_policy', async () => {
    await expect(
      failWith(400, { error: { message: 'violates our usage policy' } }),
    ).rejects.toMatchObject({ code: 'content_policy' });
  });

  it('maps other 400 responses to non-retryable unavailable', async () => {
    await expect(failWith(400, { error: { message: 'bad param' } })).rejects.toMatchObject({
      code: 'unavailable',
      retryable: false,
    });
  });

  it('maps network errors to unavailable', async () => {
    await expect(rejectWith(new TypeError('fetch failed'))).rejects.toMatchObject({
      code: 'unavailable',
      retryable: true,
    });
  });

  it('maps ETIMEDOUT to timeout', async () => {
    await expect(
      rejectWith(Object.assign(new Error('x'), { code: 'ETIMEDOUT' })),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('maps the internal 120 s timeout to timeout', async () => {
    vi.useFakeTimers();
    const { fetchImplementation } = stubFetch(() => new Promise<Response>(() => {}));
    const pending = createOpenRouter('k', fetchImplementation).complete({ model: 'm', messages });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
  });

  it('surfaces a caller abort as the abort, not a timeout', async () => {
    const controller = new AbortController();
    const reason = new DOMException('stop', 'AbortError');
    const { fetchImplementation } = stubFetch(() => new Promise<Response>(() => {}));
    const pending = createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages,
      signal: controller.signal,
    });
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
  });
});
