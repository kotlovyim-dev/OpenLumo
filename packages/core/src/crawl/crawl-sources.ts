import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { assets, brandSources, type Database } from '@openlumo/db';
import type { AssetStorage } from '../assets/asset-storage';
import type { CrawlResult } from './crawl-site';

export const pageSourceMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  openGraph: z.record(z.string(), z.string()),
  palette: z.array(z.string()).optional(),
});

export type PageSourceMeta = z.infer<typeof pageSourceMetaSchema>;

const logoExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

async function storeLogo(
  tx: Transaction,
  storage: AssetStorage,
  brandId: string,
  logo: NonNullable<CrawlResult['logo']>,
): Promise<string> {
  const id = randomUUID();
  const extension = logoExtensions[logo.mimeType] ?? 'bin';
  const storageKey = `brands/${brandId}/${id}.${extension}`;
  await storage.write(storageKey, logo.bytes);
  await tx.insert(assets).values({ id, brandId, kind: 'logo', storageKey, mimeType: logo.mimeType });
  return id;
}

export async function saveCrawlSources(
  db: Database,
  storage: AssetStorage,
  brandId: string,
  crawl: CrawlResult,
): Promise<{ logoAssetId?: string }> {
  return db.transaction(async (tx) => {
    await tx.delete(brandSources).where(eq(brandSources.brandId, brandId));
    await tx.delete(assets).where(eq(assets.brandId, brandId));
    if (crawl.pages.length > 0) {
      await tx.insert(brandSources).values(
        crawl.pages.map((page, index) => ({
          brandId,
          kind: 'page' as const,
          url: page.url,
          text: page.text,
          meta: {
            title: page.title,
            description: page.description,
            openGraph: page.openGraph,
            ...(index === 0 ? { palette: crawl.palette } : {}),
          } satisfies PageSourceMeta,
        })),
      );
    }
    if (!crawl.logo) return {};
    await tx.insert(brandSources).values({ brandId, kind: 'logo', url: crawl.logo.url });
    return { logoAssetId: await storeLogo(tx, storage, brandId, crawl.logo) };
  });
}

export async function loadCrawlSources(
  db: Database,
  brandId: string,
): Promise<(CrawlResult & { logoAssetId?: string }) | null> {
  const sources = await db
    .select()
    .from(brandSources)
    .where(and(eq(brandSources.brandId, brandId), eq(brandSources.kind, 'page')));
  const [logo] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.brandId, brandId), eq(assets.kind, 'logo')));
  if (sources.length === 0 && !logo) return null;
  const metas = sources.map((source) => {
    const parsed = pageSourceMetaSchema.safeParse(source.meta);
    return parsed.success ? parsed.data : { title: '', description: '', openGraph: {} };
  });
  const pages = sources.map((source, index) => ({
    url: source.url,
    title: metas[index]!.title,
    description: metas[index]!.description,
    text: source.text ?? '',
    openGraph: metas[index]!.openGraph,
    links: [],
    imageUrls: [],
    stylesheetUrls: [],
    inlineCss: '',
  }));
  const palette = metas.map((meta) => ('palette' in meta ? meta.palette : undefined)).find(Boolean) ?? [];
  return { pages, palette, ...(logo ? { logoAssetId: logo.id } : {}) };
}
