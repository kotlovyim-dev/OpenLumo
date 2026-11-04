import { assets, type Database } from '@openlumo/db';
import { eq } from 'drizzle-orm';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { AssetStorage } from './asset-storage';

export async function readLogo(db: Database, storage: AssetStorage, dna: BrandDna): Promise<Uint8Array | undefined> {
  const { logoAssetId } = dna.visuals;
  if (!logoAssetId) return undefined;
  const [logo] = await db.select({ storageKey: assets.storageKey }).from(assets).where(eq(assets.id, logoAssetId));
  return logo ? storage.read(logo.storageKey) : undefined;
}
