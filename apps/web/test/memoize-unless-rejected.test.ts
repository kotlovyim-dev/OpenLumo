import { describe, expect, it, vi } from 'vitest';
import { memoizeUnlessRejected } from '../src/lib/memoize-unless-rejected';

describe('memoizeUnlessRejected', () => {
  it('creates once while the promise resolves', async () => {
    const create = vi.fn(async () => 'value');
    const get = memoizeUnlessRejected(create);
    await get();
    await get();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries after a rejection', async () => {
    const create = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('up');
    const get = memoizeUnlessRejected(create);
    await expect(get()).rejects.toThrow('down');
    await expect(get()).resolves.toBe('up');
    await expect(get()).resolves.toBe('up');
    expect(create).toHaveBeenCalledTimes(2);
  });
});
