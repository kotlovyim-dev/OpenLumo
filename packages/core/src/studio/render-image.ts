import sharp from 'sharp';
import type { AspectRatio, ImageModel, ImageResult } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';

export function renderImage(
  imageModel: ImageModel,
  modelId: string,
  brief: string,
  dna: BrandDna,
  aspectRatio: AspectRatio,
): Promise<ImageResult> {
  const { imageStyle, palette } = dna.visuals;
  const prompt = [
    brief,
    imageStyle && `Style: ${imageStyle}`,
    palette.length > 0 && `Brand palette: ${palette.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
  return imageModel.generate({ model: modelId, prompt, aspectRatio });
}

export async function measureImage(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const { width, height } = await sharp(bytes).metadata();
  if (!width || !height) throw new Error('Image has no dimensions');
  return { width, height };
}

export async function toPng(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp(bytes).png().toBuffer());
}
