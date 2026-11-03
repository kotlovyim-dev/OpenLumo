import { ProviderError } from '../provider-error';
import type { OpenRouterClient } from './openrouter-client';

export function createOpenRouterKeyVerifier(client: OpenRouterClient): { verifyKey(): Promise<boolean> } {
  return {
    async verifyKey() {
      try {
        await client.get('/key');
        return true;
      } catch (error) {
        if (error instanceof ProviderError && error.code === 'unauthorized') return false;
        throw error;
      }
    },
  };
}
