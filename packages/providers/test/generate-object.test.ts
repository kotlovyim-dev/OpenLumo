import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateObject } from '../src/generate-object';
import { FakeProvider } from '../src/fake/fake-provider';
import { ProviderError } from '../src/provider-error';
import type { TextRequest } from '../src/types';

const schema = z.object({ name: z.string(), age: z.number() });
const base = {
  model: 'm',
  messages: [{ role: 'user' as const, content: 'go' }],
  schema,
  schemaName: 'person',
};
const usage = (n: number) => ({ inputTokens: n, outputTokens: n, costUsd: n / 10 });

describe('generateObject', () => {
  it('parses JSON wrapped in a json code fence', async () => {
    const provider = new FakeProvider({ textResponses: ['```json\n{"name":"Ann","age":3}\n```'] });
    const { value } = await generateObject(provider, base);
    expect(value).toEqual({ name: 'Ann', age: 3 });
    const sent = provider.requests[0] as TextRequest;
    expect(sent.jsonSchema?.name).toBe('person');
    expect(sent.jsonSchema?.schema).toMatchObject({ type: 'object' });
  });

  it('sends a strict JSON schema with additionalProperties false on every object', async () => {
    const nested = z.object({ name: z.string(), address: z.object({ city: z.string() }) });
    const provider = new FakeProvider({ textResponses: ['{"name":"Ann","address":{"city":"Kyiv"}}'] });
    await generateObject(provider, { ...base, schema: nested });
    const sent = (provider.requests[0] as TextRequest).jsonSchema?.schema as {
      additionalProperties: boolean;
      properties: { address: { additionalProperties: boolean } };
    };
    expect(sent.additionalProperties).toBe(false);
    expect(sent.properties.address.additionalProperties).toBe(false);
  });

  it('drops unknown keys', async () => {
    const provider = new FakeProvider({ textResponses: ['{"name":"Ann","age":3,"extra":true}'] });
    const { value } = await generateObject(provider, base);
    expect(value).toEqual({ name: 'Ann', age: 3 });
  });

  it('repairs once with the validation issues and succeeds', async () => {
    const provider = new FakeProvider({
      textResponses: ['{"name":"Ann"}', '{"name":"Ann","age":3}'],
    });
    const { value } = await generateObject(provider, base);
    expect(value).toEqual({ name: 'Ann', age: 3 });
    expect(provider.requests).toHaveLength(2);
    const second = provider.requests[1] as TextRequest;
    expect(second.messages.at(-1)?.role).toBe('user');
    expect(second.messages.at(-1)?.content).toContain('age');
  });

  it('throws invalid_output after a failed repair', async () => {
    const provider = new FakeProvider({ textResponses: ['nope', '{"name":1}'] });
    const failure = await generateObject(provider, base).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProviderError);
    expect(failure).toMatchObject({ code: 'invalid_output', retryable: false });
    expect(provider.requests).toHaveLength(2);
  });

  it('adds usage from both attempts', async () => {
    const provider = new FakeProvider({
      textResponses: [
        { text: '{}', toolCalls: [], usage: usage(10) },
        { text: '{"name":"Ann","age":3}', toolCalls: [], usage: usage(5) },
      ],
    });
    const result = await generateObject(provider, base);
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 15, costUsd: 1.5 });
  });
});
