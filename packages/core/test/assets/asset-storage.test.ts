import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAssetStorage, type AssetStorage } from '../../src/assets/asset-storage';

describe('asset storage', () => {
  let directory: string;
  let storage: AssetStorage;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'openlumo-assets-'));
    storage = createAssetStorage(directory);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('round-trips bytes', async () => {
    const bytes = Uint8Array.from([1, 2, 3, 255]);
    await storage.write('brands/b1/a1.png', bytes);
    expect(await storage.read('brands/b1/a1.png')).toEqual(bytes);
    expect(storage.path('brands/b1/a1.png')).toBe(join(directory, 'brands', 'b1', 'a1.png'));
  });

  it('rejects keys that escape the directory', async () => {
    await expect(storage.write('../escape.png', new Uint8Array())).rejects.toThrow();
    expect(() => storage.path('brands/../../escape.png')).toThrow();
    expect(() => storage.path('/etc/passwd')).toThrow();
    expect(() => storage.path('C:\\Windows\\x.png')).toThrow();
  });
});
