import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { jsonResponse, stubFetch, textCompletion } from './stub-fetch';

const messages = [{ role: 'user' as const, content: 'hi' }];

describe('OpenRouter language model', () => {
  it('posts text requests with auth headers and maps usage', async () => {
    const { fetchImplementation, calls } = stubFetch(() => jsonResponse(textCompletion));
    const result = await createOpenRouter('sk-1', fetchImplementation).complete({
      model: 'a/b',
      messages,
    });
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: 'Bearer sk-1',
      'HTTP-Referer': 'https://github.com/openlumo/openlumo',
      'X-Title': 'OpenLumo',
    });
    expect(calls[0]?.body).toEqual({ model: 'a/b', messages });
    expect(result).toEqual({
      text: 'hello',
      toolCalls: [],
      usage: { inputTokens: 12, outputTokens: 5, costUsd: 0.0004 },
    });
  });

  it('treats a missing cost as zero', async () => {
    const { fetchImplementation } = stubFetch(() =>
      jsonResponse({
        choices: [{ message: { content: 'x' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    );
    const result = await createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages,
    });
    expect(result.usage.costUsd).toBe(0);
  });

  it('sends a strict json_schema response format', async () => {
    const { fetchImplementation, calls } = stubFetch(() => jsonResponse(textCompletion));
    const schema = { type: 'object', properties: {} };
    await createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages,
      jsonSchema: { name: 'thing', schema },
    });
    expect(calls[0]?.body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'thing', schema, strict: true },
    });
  });

  it('sends tools in OpenAI format and parses tool calls', async () => {
    const { fetchImplementation, calls } = stubFetch(() =>
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: { name: 'lookup', arguments: '{"q":"x"}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
      }),
    );
    const parameters = { type: 'object' };
    const result = await createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages,
      tools: [{ name: 'lookup', description: 'find', parameters }],
    });
    expect(calls[0]?.body.tools).toEqual([
      { type: 'function', function: { name: 'lookup', description: 'find', parameters } },
    ]);
    expect(result.text).toBe('');
    expect(result.toolCalls).toEqual([{ id: 'c1', name: 'lookup', arguments: { q: 'x' } }]);
  });

  it('maps tool messages with tool_call_id', async () => {
    const { fetchImplementation, calls } = stubFetch(() => jsonResponse(textCompletion));
    await createOpenRouter('k', fetchImplementation).complete({
      model: 'm',
      messages: [{ role: 'tool', content: 'r', toolCallId: 'c1' }],
    });
    expect(calls[0]?.body.messages).toEqual([{ role: 'tool', content: 'r', tool_call_id: 'c1' }]);
  });

  it('throws invalid_output when tool call arguments are not JSON', async () => {
    const { fetchImplementation } = stubFetch(() =>
      jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [{ id: 'c', type: 'function', function: { name: 'n', arguments: '{' } }],
            },
          },
        ],
      }),
    );
    await expect(
      createOpenRouter('k', fetchImplementation).complete({ model: 'm', messages }),
    ).rejects.toMatchObject({ code: 'invalid_output' });
  });
});
