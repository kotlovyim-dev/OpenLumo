import {
  createPartialBrandDna,
  findBrand,
  getBrandDna,
  loadCrawlSources,
  saveBrandDna,
  setBrandStatus,
} from '@openlumo/core';
import type { Database } from '@openlumo/db';

export async function fallBackToManualInput(db: Database, brandId: string): Promise<void> {
  if (!(await getBrandDna(db, brandId))) {
    const brand = await findBrand(db, brandId);
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
  await setBrandStatus(db, brandId, 'needs_input');
}
