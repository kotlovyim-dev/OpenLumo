import { assets, type Database } from '@openlumo/db';
import type { AssetStorage } from '../assets/asset-storage';
import { brandStorageKey } from '../assets/brand-storage-key';
import { measureImage } from './render-image';

export async function saveGeneratedImage(
  db: Database,
  storage: AssetStorage,
  input: { brandId: string; bytes: Uint8Array; provider: string; model: string; prompt: string },
): Promise<string> {
  const { brandId, bytes, provider, model, prompt } = input;
  const assetId = crypto.randomUUID();
  const storageKey = brandStorageKey(brandId, `${assetId}.png`);
  await storage.write(storageKey, bytes);
  const { width, height } = await measureImage(bytes);
  await db.insert(assets).values({
    id: assetId,
    brandId,
    kind: 'image',
    storageKey,
    mimeType: 'image/png',
    width,
    height,
    provider,
    model,
    prompt,
  });
  return assetId;
}
