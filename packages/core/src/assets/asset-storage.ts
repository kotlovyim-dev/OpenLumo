import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix, win32 } from 'node:path';

export type AssetStorage = {
  write(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  path(key: string): string;
};

function assertSafeKey(key: string): void {
  const escapes = key.split(/[\\/]/).includes('..');
  if (escapes || posix.isAbsolute(key) || win32.isAbsolute(key)) {
    throw new Error(`Invalid asset key: ${key}`);
  }
}

export function createAssetStorage(directory: string): AssetStorage {
  const path = (key: string) => {
    assertSafeKey(key);
    return join(directory, key);
  };
  return {
    path,
    async write(key, bytes) {
      const target = path(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    },
    async read(key) {
      return new Uint8Array(await readFile(path(key)));
    },
  };
}
