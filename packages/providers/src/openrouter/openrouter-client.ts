import { ProviderError } from '../provider-error';
import { errorFromResponse, errorFromThrown } from './error-mapping';

const baseUrl = 'https://openrouter.ai/api/v1';
const requestTimeoutMs = 120_000;

export type OpenRouterClient = {
  get<T>(path: string, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
};

export function createOpenRouterClient(
  apiKey: string,
  fetchImplementation: typeof fetch,
): OpenRouterClient {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/openlumo/openlumo',
    'X-Title': 'OpenLumo',
  };

  async function send<T>(
    path: string,
    init: { method: string; body?: string },
    callerSignal?: AbortSignal,
  ): Promise<T> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), requestTimeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout.signal]) : timeout.signal;
    try {
      const response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal,
      });
      if (!response.ok) throw errorFromResponse(response.status, await response.text());
      return (await response.json()) as T;
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      if (error instanceof ProviderError) throw error;
      throw errorFromThrown(error, timeout.signal.aborted);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: (path, signal) => send(path, { method: 'GET' }, signal),
    post: (path, body, signal) =>
      send(path, { method: 'POST', body: JSON.stringify(body) }, signal),
  };
}
