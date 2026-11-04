import { readFile } from 'node:fs/promises';
import sharp, { type OverlayOptions } from 'sharp';
import satori from 'satori';
import { MAX_HEADLINE_LENGTH } from './format-schemas';
import { measureImage } from './render-image';

const fontPath = new URL('../../assets/fonts/Inter-Bold.ttf', import.meta.url);
const LOGO_WIDTH_RATIO = 0.12;
const LOGO_MAX_HEIGHT_RATIO = 0.25;
const MARGIN_RATIO = 0.04;

let fontData: Promise<Buffer> | undefined;

function loadFont(): Promise<Buffer> {
  fontData ??= readFile(fontPath);
  return fontData;
}

function boundHeadline(headline: string): string {
  const characters = Array.from(headline);
  return characters.length > MAX_HEADLINE_LENGTH ? `${characters.slice(0, MAX_HEADLINE_LENGTH - 1).join('')}…` : headline;
}

type Overlay = { headline: string; logo?: Uint8Array; accentColor: string };

async function renderLayer(width: number, height: number, overlay: Overlay): Promise<Buffer> {
  const headline = boundHeadline(overlay.headline);
  const margin = Math.round(width * MARGIN_RATIO);
  const tree = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width,
        height,
        padding: margin,
      },
      children: headline
        ? [
            {
              type: 'div',
              props: { style: { width: Math.round(width * 0.2), height: Math.round(height * 0.012), background: overlay.accentColor, marginBottom: margin / 2 } },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: Math.round(width * 0.07),
                  color: '#ffffff',
                  textShadow: '0 2px 12px rgba(0,0,0,0.7)',
                  paddingRight: Math.round(width * LOGO_WIDTH_RATIO),
                },
                children: headline,
              },
            },
          ]
        : [],
    },
  };
  const font = await loadFont();
  const svg = await satori(tree, { width, height, fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }] });
  return Buffer.from(svg);
}

export async function composeOverlay(image: Uint8Array, overlay: Overlay): Promise<Uint8Array> {
  const { width, height } = await measureImage(image);

  const layers: OverlayOptions[] = [{ input: await renderLayer(width, height, overlay) }];
  if (overlay.logo) {
    const logoWidth = Math.max(1, Math.round(width * LOGO_WIDTH_RATIO));
    const margin = Math.round(width * MARGIN_RATIO);
    const logo = await sharp(overlay.logo)
      .resize({ width: logoWidth, height: Math.max(1, Math.round(height * LOGO_MAX_HEIGHT_RATIO)), fit: 'inside' })
      .png()
      .toBuffer();
    const { width: placedWidth, height: placedHeight } = await measureImage(logo);
    layers.push({
      input: logo,
      left: Math.max(0, width - placedWidth - margin),
      top: Math.max(0, height - placedHeight - margin),
    });
  }
  return new Uint8Array(await sharp(image).composite(layers).png().toBuffer());
}
