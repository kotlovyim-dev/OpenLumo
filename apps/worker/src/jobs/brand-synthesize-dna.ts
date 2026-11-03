import { and, eq } from 'drizzle-orm';
import {
  type CrawlResult,
  defineJob,
  resolveModels,
  saveBrandDna,
  synthesizeBrandDna,
} from '@openlumo/core';
import { assets, brandSources, brands } from '@openlumo/db';
import type { WorkerDependencies } from '../worker-dependencies';

type PageMeta = {
  title: string;
  description: string;
  openGraph: Record<string, string>;
  palette?: string[];
};

export function createBrandSynthesizeDnaJob({ db, config }: WorkerDependencies) {
  return defineJob('brand.synthesize-dna', async ({ brandId }, context) => {
    await context.reportProgress('Learning your brand');

    const sources = await db
      .select()
      .from(brandSources)
      .where(and(eq(brandSources.brandId, brandId), eq(brandSources.kind, 'page')));
    const pages = sources.map((source) => {
      const meta = source.meta as PageMeta;
      return {
        url: source.url,
        title: meta.title,
        description: meta.description,
        text: source.text ?? '',
        openGraph: meta.openGraph,
        links: [],
        imageUrls: [],
        stylesheetUrls: [],
        inlineCss: '',
      };
    });
    const palette = sources.map((source) => (source.meta as PageMeta).palette).find(Boolean) ?? [];
    const crawl: CrawlResult = { pages, palette };

    const { brain } = await resolveModels(db, config);
    const { dna, usage } = await synthesizeBrandDna(brain.model, brain.modelId, crawl, []);
    await context.recordUsage(usage);

    const [logo] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.brandId, brandId), eq(assets.kind, 'logo')));
    await saveBrandDna(db, brandId, logo ? { ...dna, visuals: { ...dna.visuals, logoAssetId: logo.id } } : dna);
    await db.update(brands).set({ status: 'ready' }).where(eq(brands.id, brandId));
  });
}
