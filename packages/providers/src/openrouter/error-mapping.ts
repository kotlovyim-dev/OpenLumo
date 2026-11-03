import { ProviderError } from '../provider-error';

const contentPolicyPattern = /moderation|policy/i;

export function errorFromResponse(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) return new ProviderError('unauthorized', body);
  if (status === 429) return new ProviderError('rate_limited', body);
  if (status === 408) return new ProviderError('timeout', body);
  if (status === 400 && contentPolicyPattern.test(body)) {
    return new ProviderError('content_policy', body);
  }
  return new ProviderError('unavailable', body, status >= 500);
}

export function errorFromThrown(error: unknown, timedOut: boolean): ProviderError {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  if (timedOut || code === 'ETIMEDOUT') return new ProviderError('timeout', message);
  return new ProviderError('unavailable', message);
}
