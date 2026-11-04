import {
  appendVersion,
  aspectRatioFor,
  attachAssets,
  BrandNotReadyError,
  composeOverlay,
  copyLanguage,
  defineJob,
  generateCopy,
  getBrandDna,
  getItemWithCurrentVersion,
  getVersion,
  ItemNotFoundError,
  listOpenFeedback,
  measureImage,
  renderImage,
  resolveModels,
  type BrandDna,
  type ContentItem,
  type FormatCopy,
  type ItemVersion,
  type JobContext,
  type JobPayload,
} from '@openlumo/core';
import { assets } from '@openlumo/db';
import { eq } from 'drizzle-orm';
import type { WorkerDependencies } from '../worker-dependencies';

type ImageBrief = { prompt: string; headlineOverlay?: string };

const DEFAULT_ACCENT_COLOR = '#6d55f0';

function imageBriefs(copy: FormatCopy): ImageBrief[] {
  if ('slides' in copy) return copy.slides.map((slide) => slide.imageBrief);
  return 'imageBrief' in copy ? [copy.imageBrief] : [];
}

async function writeCopy(
  { db, config }: WorkerDependencies,
  { brandId, itemId, targetVersion, instruction }: JobPayload<'item.generate'>,
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
  return appendVersion(db, itemId, targetVersion, { copy, author: 'planner' });
}

async function loadLogo({ db, storage }: WorkerDependencies, dna: BrandDna): Promise<Uint8Array | undefined> {
  const { logoAssetId } = dna.visuals;
  if (!logoAssetId) return undefined;
  const [logo] = await db.select({ storageKey: assets.storageKey }).from(assets).where(eq(assets.id, logoAssetId));
  return logo ? storage.read(logo.storageKey) : undefined;
}

async function writeImages(
  deps: WorkerDependencies,
  brandId: string,
  item: ContentItem,
  version: ItemVersion,
  context: JobContext,
): Promise<void> {
  const briefs = imageBriefs(version.copy as FormatCopy);
  if (briefs.length === 0) return;
  const { db, config, storage } = deps;

  await context.reportProgress('Rendering image');
  const saved = await getBrandDna(db, brandId);
  if (!saved) throw new BrandNotReadyError(brandId);
  const { image } = await resolveModels(db, config);
  const logo = await loadLogo(deps, saved.dna);
  const accentColor = saved.dna.visuals.palette[0] ?? DEFAULT_ACCENT_COLOR;
  const aspectRatio = aspectRatioFor(item.channel, item.format);

  const assetIds: string[] = [];
  for (const brief of briefs) {
    const rendered = await renderImage(image.model, image.modelId, brief.prompt, saved.dna, aspectRatio);
    await context.recordUsage(rendered.usage);
    const bytes = brief.headlineOverlay
      ? await composeOverlay(rendered.bytes, { headline: brief.headlineOverlay, logo, accentColor })
      : rendered.bytes;
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
  }
  await attachAssets(db, version.id, assetIds);
}

async function generateItem(
  deps: WorkerDependencies,
  payload: JobPayload<'item.generate'>,
  context: JobContext,
): Promise<void> {
  const { db } = deps;
  const { itemId, targetVersion } = payload;
  const found = await getItemWithCurrentVersion(db, itemId);
  if (!found) throw new ItemNotFoundError(itemId);

  const existing = await getVersion(db, itemId, targetVersion);
  const version = existing ?? (await writeCopy(deps, payload, found.item, context));
  if (!version) return;
  if (existing && (imageBriefs(existing.copy as FormatCopy).length === 0 || existing.assetIds.length > 0)) return;
  await writeImages(deps, payload.brandId, found.item, version, context);
}

export function createItemGenerateJob(deps: WorkerDependencies) {
  return defineJob('item.generate', (payload, context) => generateItem(deps, payload, context));
}
