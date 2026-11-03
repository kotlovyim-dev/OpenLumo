export type ProviderErrorCode =
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'unauthorized'
  | 'content_policy'
  | 'invalid_output';

const retryableCodes: readonly ProviderErrorCode[] = ['rate_limited', 'timeout', 'unavailable'];

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string = code) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryableCodes.includes(code);
  }
}
