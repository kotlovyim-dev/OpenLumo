import { and, eq } from 'drizzle-orm';
import { createPartialBrandDna, getBrandDna, saveBrandDna } from '@openlumo/core';
import { assets, brandSources, brands, type Database } from '@openlumo/db';

type PageMeta = { title?: string; openGraph?: Record<string, string>; palette?: string[] };

export async function fallBackToManualInput(db: Database, brandId: string): Promise<void> {
  if (!(await getBrandDna(db, brandId))) {
    const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
    const pages = await db
      .select()
      .from(brandSources)
      .where(and(eq(brandSources.brandId, brandId), eq(brandSources.kind, 'page')));
    const metas = pages.map((page) => (page.meta ?? {}) as PageMeta);
    const [logo] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.brandId, brandId), eq(assets.kind, 'logo')));
    const name =
      metas.find((meta) => meta.openGraph?.['og:site_name'])?.openGraph?.['og:site_name'] ||
      metas.find((meta) => meta.title)?.title ||
      brand?.name ||
      '';
    await saveBrandDna(
      db,
      brandId,
      createPartialBrandDna({
        name,
        palette: metas.find((meta) => meta.palette)?.palette ?? [],
        ...(logo ? { logoAssetId: logo.id } : {}),
      }),
    );
  }
  await db.update(brands).set({ status: 'needs_input' }).where(eq(brands.id, brandId));
}
