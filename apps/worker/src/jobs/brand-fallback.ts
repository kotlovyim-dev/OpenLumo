import { eq } from 'drizzle-orm';
import { createPartialBrandDna, getBrandDna, loadCrawlSources, saveBrandDna } from '@openlumo/core';
import { brands, type Database } from '@openlumo/db';

export async function fallBackToManualInput(db: Database, brandId: string): Promise<void> {
  if (!(await getBrandDna(db, brandId))) {
    const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
    const crawl = await loadCrawlSources(db, brandId);
    const pages = crawl?.pages ?? [];
    const name =
      pages.find((page) => page.openGraph['og:site_name'])?.openGraph['og:site_name'] ||
      pages.find((page) => page.title)?.title ||
      brand?.name ||
      '';
    await saveBrandDna(
      db,
      brandId,
      createPartialBrandDna({
        name,
        palette: crawl?.palette ?? [],
        ...(crawl?.logoAssetId ? { logoAssetId: crawl.logoAssetId } : {}),
      }),
    );
  }
  await db.update(brands).set({ status: 'needs_input' }).where(eq(brands.id, brandId));
}
