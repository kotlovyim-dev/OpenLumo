import { describe, expect, it } from 'vitest';
import { brandStorageKey } from './brand-storage-key';

describe('brandStorageKey', () => {
  it('joins the brand id and parts under brands/', () => {
    expect(brandStorageKey('b1', 'exports', 'a.zip')).toBe('brands/b1/exports/a.zip');
    expect(brandStorageKey('b1', 'x.png')).toBe('brands/b1/x.png');
  });
});
