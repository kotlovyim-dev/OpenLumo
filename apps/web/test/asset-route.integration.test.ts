import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addBrandMember, createAssetStorage, createBrand, type AssetStorage } from '@openlumo/core';
import { assets, users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { assetResponse } from '../src/features/assets/asset-response';

describe('asset route', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let directory: string;
  let storage: AssetStorage;
  let brandId: string;
  let otherBrandId: string;

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const zip = new Uint8Array([0x50, 0x4b, 3, 4, 9]);

  beforeAll(async () => {
    database = await createTestDatabase();
    directory = await mkdtemp(join(tmpdir(), 'openlumo-assets-'));
    storage = createAssetStorage(directory);
    for (const id of ['owner', 'viewer', 'stranger']) {
      await database.db.insert(users).values({ id, name: id, email: `${id}@example.com` });
    }
    brandId = (await createBrand(database.db, { name: 'Acme', createdBy: 'owner' })).id;
    otherBrandId = (await createBrand(database.db, { name: 'Other', createdBy: 'stranger' })).id;
    await addBrandMember(database.db, brandId, 'viewer', 'viewer');
  });

  afterAll(async () => {
    await database.drop();
    await rm(directory, { recursive: true, force: true });
  });

  async function storeAsset(brand: string, storageKey: string, mimeType: string, bytes: Uint8Array | null) {
    if (bytes) await storage.write(storageKey, bytes);
    const [asset] = await database.db
      .insert(assets)
      .values({ brandId: brand, kind: mimeType.startsWith('image/') ? 'image' : 'export', storageKey, mimeType })
      .returning();
    return asset!.id;
  }

  const respond = (userId: string | null, assetId: string) => assetResponse({ db: database.db, storage }, userId, assetId);

  it('streams an image inline to a viewer of its brand', async () => {
    const assetId = await storeAsset(brandId, `brands/${brandId}/images/a.png`, 'image/png', png);
    const response = await respond('viewer', assetId);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe(String(png.length));
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  });

  it('serves a ZIP as an attachment', async () => {
    const assetId = await storeAsset(brandId, `brands/${brandId}/exports/b.zip`, 'application/zip', zip);
    const response = await respond('owner', assetId);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="openlumo-export-${assetId}.zip"`);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(zip);
  });

  it('returns 401 without a session', async () => {
    const assetId = await storeAsset(brandId, `brands/${brandId}/images/c.png`, 'image/png', png);
    const response = await respond(null, assetId);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it("returns the same 404 for another brand's asset as for a missing one", async () => {
    const otherAssetId = await storeAsset(otherBrandId, `brands/${otherBrandId}/images/d.png`, 'image/png', png);
    const responses = [
      await respond('viewer', otherAssetId),
      await respond('viewer', crypto.randomUUID()),
      await respond('viewer', 'not-a-uuid'),
    ];
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
  });

  it('returns 404 when the stored key escapes the storage root or the file is gone', async () => {
    const escaping = await storeAsset(brandId, '../outside.png', 'image/png', null);
    const missing = await storeAsset(brandId, `brands/${brandId}/images/gone.png`, 'image/png', null);
    for (const assetId of [escaping, missing]) {
      const response = await respond('viewer', assetId);
      expect(response.status).toBe(404);
    }
  });
});
