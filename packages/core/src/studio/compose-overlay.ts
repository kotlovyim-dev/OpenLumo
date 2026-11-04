import { readFile } from 'node:fs/promises';
import sharp, { type OverlayOptions } from 'sharp';
import satori from 'satori';
import { measureImage } from './render-image';

const fontPath = new URL('../../assets/fonts/Inter-Bold.ttf', import.meta.url);
const LOGO_WIDTH_RATIO = 0.12;
const MARGIN_RATIO = 0.04;

type Overlay = { headline: string; logo?: Uint8Array; accentColor: string };

async function renderLayer(width: number, height: number, overlay: Overlay): Promise<Buffer> {
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
      children: overlay.headline
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
                children: overlay.headline,
              },
            },
          ]
        : [],
    },
  };
  const font = await readFile(fontPath);
  const svg = await satori(tree, { width, height, fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }] });
  return Buffer.from(svg);
}

export async function composeOverlay(image: Uint8Array, overlay: Overlay): Promise<Uint8Array> {
  const { width, height } = await measureImage(image);

  const layers: OverlayOptions[] = [{ input: await renderLayer(width, height, overlay) }];
  if (overlay.logo) {
    const logoWidth = Math.max(1, Math.round(width * LOGO_WIDTH_RATIO));
    const margin = Math.round(width * MARGIN_RATIO);
    const logo = await sharp(overlay.logo).resize({ width: logoWidth }).png().toBuffer();
    const { height: logoHeight = logoWidth } = await sharp(logo).metadata();
    layers.push({
      input: logo,
      left: Math.max(0, width - logoWidth - margin),
      top: Math.max(0, height - logoHeight - margin),
    });
  }
  return new Uint8Array(await sharp(image).composite(layers).png().toBuffer());
}
