import { ProviderError } from '../provider-error';
import { errorFromResponse, errorFromThrown } from './error-mapping';

const baseUrl = 'https://openrouter.ai/api/v1';
const requestTimeoutMs = 120_000;

export type OpenRouterClient = {
  get<T>(path: string, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  stream(path: string, body: unknown, onEvent: (data: unknown) => void, signal?: AbortSignal): Promise<void>;
};

async function readServerSentEvents(response: Response, onEvent: (data: unknown) => void): Promise<void> {
  if (!response.body) throw new ProviderError('invalid_output', 'Stream has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = (lines: string[]) => {
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice('data:'.length).trim();
      if (data && data !== '[DONE]') onEvent(JSON.parse(data));
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    flush(lines);
  }
  flush([buffer + decoder.decode()]);
}

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
    callerSignal: AbortSignal | undefined,
    read: (response: Response) => Promise<T>,
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
      return await read(response);
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      if (error instanceof ProviderError) throw error;
      throw errorFromThrown(error, timeout.signal.aborted);
    } finally {
      clearTimeout(timer);
    }
  }

  const readJson = <T>(response: Response) => response.json() as Promise<T>;

  return {
    get: <T>(path: string, signal?: AbortSignal) => send(path, { method: 'GET' }, signal, readJson<T>),
    post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
      send(path, { method: 'POST', body: JSON.stringify(body) }, signal, readJson<T>),
    stream: (path, body, onEvent, signal) =>
      send(path, { method: 'POST', body: JSON.stringify({ ...(body as object), stream: true }) }, signal, (response) =>
        readServerSentEvents(response, onEvent),
      ),
  };
}
