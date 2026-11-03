import { describe, expect, it } from 'vitest';
import { FakeProvider } from '../src/fake/fake-provider';
import { ProviderError } from '../src/provider-error';
import type { ImageRequest, TextRequest } from '../src/types';

const textRequest: TextRequest = { model: 'm', messages: [{ role: 'user', content: 'hi' }] };
const imageRequest: ImageRequest = { model: 'm', prompt: 'p', aspectRatio: '1:1' };

describe('FakeProvider text', () => {
  it('prefers respond over textResponses', async () => {
    const provider = new FakeProvider({
      textResponses: ['listed'],
      respond: (request) => `echo ${request.model}`,
    });
    expect((await provider.complete(textRequest)).text).toBe('echo m');
  });

  it('throws a ProviderError listed in textResponses', async () => {
    const error = new ProviderError('rate_limited');
    const provider = new FakeProvider({ textResponses: [error] });
    await expect(provider.complete(textRequest)).rejects.toBe(error);
  });

  it('repeats the last response after the list is exhausted', async () => {
    const provider = new FakeProvider({ textResponses: ['a', 'b'] });
    const texts = [];
    for (let i = 0; i < 4; i++) texts.push((await provider.complete(textRequest)).text);
    expect(texts).toEqual(['a', 'b', 'b', 'b']);
  });
});

describe('FakeProvider image', () => {
  it('calls an image function with the request', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const provider = new FakeProvider({
      image: (request) => (request.prompt === 'p' ? bytes : new Uint8Array([9])),
    });
    expect((await provider.generate(imageRequest)).bytes).toBe(bytes);
  });

  it('throws a ProviderError image', async () => {
    const error = new ProviderError('content_policy');
    const provider = new FakeProvider({ image: error });
    await expect(provider.generate(imageRequest)).rejects.toBe(error);
  });

  it('rejects generate when the signal is already aborted', async () => {
    const provider = new FakeProvider();
    await expect(
      provider.generate({ ...imageRequest, signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(provider.requests).toHaveLength(0);
  });

  it('returns a fresh default image each time', async () => {
    const provider = new FakeProvider();
    const first = await provider.generate(imageRequest);
    first.bytes[0] = 0;
    expect((await provider.generate(imageRequest)).bytes[0]).toBe(0x89);
  });
});

describe('FakeProvider catalog', () => {
  it('lists one text and one image model', async () => {
    const models = await new FakeProvider().listModels();
    expect(models.map((model) => model.outputModalities)).toEqual([['text'], ['image']]);
  });

  it('returns copies that cannot leak between calls', async () => {
    const provider = new FakeProvider();
    const first = await provider.listModels();
    first[0]?.outputModalities.push('video');
    expect((await provider.listModels())[0]?.outputModalities).toEqual(['text']);
  });
});
