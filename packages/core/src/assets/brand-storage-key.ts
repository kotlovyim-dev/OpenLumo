export function brandStorageKey(brandId: string, ...parts: string[]): string {
  return ['brands', brandId, ...parts].join('/');
}
