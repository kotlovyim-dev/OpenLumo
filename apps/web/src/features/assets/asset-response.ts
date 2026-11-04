import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AssetStorage } from '@openlumo/core';
import { assets, type Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';

export type AssetContext = { db: Database; storage: AssetStorage };

const attachmentExtensions: Record<string, string> = { 'application/zip': 'zip', 'text/calendar': 'ics' };

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: securityHeaders });
}

async function openStoredFile(storage: AssetStorage, storageKey: string) {
  try {
    const path = storage.path(storageKey);
    const stats = await stat(path);
    if (!stats.isFile()) return null;
    return { size: stats.size, body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array> };
  } catch {
    return null;
  }
}

function contentDisposition(asset: typeof assets.$inferSelect) {
  if (asset.mimeType.startsWith('image/')) return 'inline';
  const extension = attachmentExtensions[asset.mimeType] ?? 'bin';
  return `attachment; filename="openlumo-${asset.kind}-${asset.id}.${extension}"`;
}

export async function assetResponse(context: AssetContext, userId: string | null, assetId: string): Promise<Response> {
  if (!userId) return jsonError(401, 'unauthorized');
  if (!z.uuid().safeParse(assetId).success) return jsonError(404, 'not_found');
  const [asset] = await context.db.select().from(assets).where(eq(assets.id, assetId));
  if (!asset || !(await findBrandAccess(context.db, userId, asset.brandId, 'viewer'))) return jsonError(404, 'not_found');
  const file = await openStoredFile(context.storage, asset.storageKey);
  if (!file) return jsonError(404, 'not_found');
  return new Response(file.body, {
    headers: {
      ...securityHeaders,
      'Content-Type': asset.mimeType,
      'Content-Length': String(file.size),
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': contentDisposition(asset),
    },
  });
}
