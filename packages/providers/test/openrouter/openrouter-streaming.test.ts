import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { ProviderError } from '../../src/provider-error';
import { stubFetch } from './stub-fetch';

const messages = [{ role: 'user' as const, content: 'hi' }];

function eventStream(lines: string[], splitAt = 7): Response {
  const body = lines.join('\n');
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let start = 0; start < body.length; start += splitAt) {
          controller.enqueue(encoder.encode(body.slice(start, start + splitAt)));
        }
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

const delta = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;

describe('OpenRouter streaming', () => {
  it('streams text as it arrives and keeps the usage from the final chunk', async () => {
    const { fetchImplementation, calls } = stubFetch(() =>
      eventStream([
        ': OPENROUTER PROCESSING',
        '',
        delta('{"a"'),
        '',
        delta(':1}'),
        '',
        `data: ${JSON.stringify({ choices: [{ delta: { content: '' } }], usage: { prompt_tokens: 3, completion_tokens: 4, cost: 0.002 } })}`,
        '',
        'data: [DONE]',
        '',
      ]),
    );
    const seen: string[] = [];
    const result = await createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages,
      onText: (text) => seen.push(text),
    });
    expect(calls[0]?.body.stream).toBe(true);
    expect(seen).toEqual(['{"a"', '{"a":1}']);
    expect(result).toEqual({ text: '{"a":1}', toolCalls: [], usage: { inputTokens: 3, outputTokens: 4, costUsd: 0.002 } });
  });

  it('turns an error sent mid-stream into a provider error', async () => {
    const { fetchImplementation } = stubFetch(() =>
      eventStream([
        delta('{"a"'),
        '',
        `data: ${JSON.stringify({ error: { code: 429, message: 'Rate limit exceeded' }, choices: [{ delta: { content: '' }, finish_reason: 'error' }] })}`,
        '',
      ]),
    );
    const failure = createOpenRouter('k', fetchImplementation).complete({ model: 'm', messages, onText: () => {} });
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('does not stream requests that use tools', async () => {
    const { fetchImplementation, calls } = stubFetch(
      () => new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] })),
    );
    await createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages,
      tools: [{ name: 't', description: 'd', parameters: {} }],
      onText: () => {},
    });
    expect(calls[0]?.body).not.toHaveProperty('stream');
  });
});
