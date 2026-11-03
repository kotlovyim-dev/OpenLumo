import { describe, expect, it } from 'vitest';
import type { ImageModel, LanguageModel } from '../types';

export function runLanguageModelContract(name: string, makeModel: () => LanguageModel): void {
  describe(`${name} language model contract`, () => {
    const request = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] };

    it('returns text and non-negative usage', async () => {
      const result = await makeModel().complete(request);
      expect(typeof result.text).toBe('string');
      expect(result.usage.inputTokens).toBeGreaterThanOrEqual(0);
      expect(result.usage.outputTokens).toBeGreaterThanOrEqual(0);
      expect(result.usage.costUsd).toBeGreaterThanOrEqual(0);
    });

    it('rejects when the signal is aborted', async () => {
      await expect(
        makeModel().complete({ ...request, signal: AbortSignal.abort() }),
      ).rejects.toThrow();
    });
  });
}

export function runImageModelContract(name: string, makeModel: () => ImageModel): void {
  describe(`${name} image model contract`, () => {
    it('returns non-empty bytes with an image mime type', async () => {
      const result = await makeModel().generate({
        model: 'm',
        prompt: 'a lumo',
        aspectRatio: '1:1',
      });
      expect(result.bytes.byteLength).toBeGreaterThan(0);
      expect(result.mimeType.startsWith('image/')).toBe(true);
    });
  });
}
