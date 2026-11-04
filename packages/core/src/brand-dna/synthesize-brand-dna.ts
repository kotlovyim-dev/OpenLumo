import { generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import type { CrawlResult } from '../crawl/crawl-site';
import { buildBrandDnaMessages } from './brand-dna-prompts';
import { type BrandDna, brandDnaSchema, normalisePalette } from './brand-dna-schema';

export async function synthesizeBrandDna(
  brain: LanguageModel,
  modelId: string,
  crawl: CrawlResult,
  feedback: string[],
  researchBrief = '',
): Promise<{ dna: BrandDna; usage: Usage }> {
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildBrandDnaMessages(crawl, feedback, researchBrief),
    schema: brandDnaSchema,
    schemaName: 'brand_dna',
  });
  const palette = normalisePalette(crawl.palette.length > 0 ? crawl.palette : value.visuals.palette);
  return { dna: { ...value, visuals: { ...value.visuals, palette } }, usage };
}
