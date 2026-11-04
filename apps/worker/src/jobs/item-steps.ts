import {
  appendVersion,
  aspectRatioFor,
  attachAssets,
  BrandNotReadyError,
  composeOverlay,
  copyLanguage,
  generateCopy,
  getBrandDna,
  listOpenFeedback,
  measureImage,
  renderImage,
  readLogo,
  resolveModels,
  toPng,
  type ContentItem,
  type FormatCopy,
  type ItemVersion,
  type JobContext,
} from '@openlumo/core';
import { assets } from '@openlumo/db';
import type { WorkerDependencies } from '../worker-dependencies';

type ImageBrief = { prompt: string; headlineOverlay?: string };

const DEFAULT_ACCENT_COLOR = '#6d55f0';

function imageBriefs(copy: FormatCopy): ImageBrief[] {
  if ('slides' in copy) return copy.slides.map((slide) => slide.imageBrief);
  return 'imageBrief' in copy ? [copy.imageBrief] : [];
}

export type CopyRequest = {
  brandId: string;
  itemId: string;
  targetVersion: number;
  instruction?: string;
  author: ItemVersion['author'];
  feedback?: string;
};

export async function writeCopy(
  { db, config }: WorkerDependencies,
  { brandId, itemId, targetVersion, instruction, author, feedback }: CopyRequest,
  item: ContentItem,
  context: JobContext,
): Promise<ItemVersion | null> {
  await context.reportProgress('Writing copy');

  const saved = await getBrandDna(db, brandId);
  if (!saved) throw new BrandNotReadyError(brandId);

  const { brain } = await resolveModels(db, config);
  const { copy, usage } = await generateCopy(brain.model, brain.modelId, {
    dna: saved.dna,
    feedback: await listOpenFeedback(db, brandId),
    item: { channel: item.channel, format: item.format, pillar: item.pillar ?? '', angle: item.angle ?? '' },
    instruction,
    language: copyLanguage(saved.dna),
  });
  await context.recordUsage(usage);
  return appendVersion(db, itemId, targetVersion, { copy, author, feedback });
}

export async function writeImages(
  deps: WorkerDependencies,
  brandId: string,
  item: ContentItem,
  version: ItemVersion,
  context: JobContext,
): Promise<void> {
  const briefs = imageBriefs(version.copy as FormatCopy);
  if (version.assetIds.length >= briefs.length) return;
  const { db, config, storage } = deps;

  await context.reportProgress('Rendering image');
  const saved = await getBrandDna(db, brandId);
  if (!saved) throw new BrandNotReadyError(brandId);
  const { image } = await resolveModels(db, config);
  const logo = await readLogo(db, storage, saved.dna);
  const accentColor = saved.dna.visuals.palette[0] ?? DEFAULT_ACCENT_COLOR;
  const aspectRatio = aspectRatioFor(item.channel);

  const assetIds = [...version.assetIds];
  for (const brief of briefs.slice(assetIds.length)) {
    const rendered = await renderImage(image.model, image.modelId, brief.prompt, saved.dna, aspectRatio);
    await context.recordUsage(rendered.usage);
    const bytes = brief.headlineOverlay
      ? await composeOverlay(rendered.bytes, { headline: brief.headlineOverlay, logo, accentColor })
      : await toPng(rendered.bytes);
    const assetId = crypto.randomUUID();
    const storageKey = `brands/${brandId}/${assetId}.png`;
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
      provider: config.testProviders === 'fake' ? 'fake' : 'openrouter',
      model: image.modelId,
      prompt: brief.prompt,
    });
    assetIds.push(assetId);
    await attachAssets(db, version.id, assetIds);
  }
}
