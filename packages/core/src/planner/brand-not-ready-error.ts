export class BrandNotReadyError extends Error {
  readonly retryable = false;
  readonly code = 'brand_not_ready';

  constructor(brandId: string) {
    super(`Brand ${brandId} has no Brand DNA yet`);
    this.name = 'BrandNotReadyError';
  }
}
