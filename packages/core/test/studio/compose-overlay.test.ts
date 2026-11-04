import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { boundHeadline, composeOverlay } from '../../src/studio/compose-overlay';

async function solid(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: '#203040' } })
      .png()
      .toBuffer(),
  );
}

async function pixels(png: Uint8Array): Promise<Buffer> {
  return sharp(png).ensureAlpha().raw().toBuffer();
}

describe('composeOverlay', () => {
  it('keeps the input dimensions', async () => {
    const result = await composeOverlay(await solid(640, 800), { headline: 'Fresh daily', accentColor: '#6d55f0' });

    const meta = await sharp(result).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([640, 800, 'png']);
  });

  it('renders Cyrillic glyphs: the headline changes more than 1% of pixels', async () => {
    const image = await solid(640, 640);
    const withHeadline = await pixels(await composeOverlay(image, { headline: 'Привіт, світ', accentColor: '#6d55f0' }));
    const withoutHeadline = await pixels(await composeOverlay(image, { headline: '', accentColor: '#6d55f0' }));

    let differing = 0;
    for (let offset = 0; offset < withHeadline.length; offset += 4) {
      if (withHeadline.compare(withoutHeadline, offset, offset + 4, offset, offset + 4) !== 0) differing += 1;
    }
    expect(differing / (withHeadline.length / 4)).toBeGreaterThan(0.01);
  });

  it('places a logo in the bottom right corner', async () => {
    const image = await solid(500, 500);
    const logo = new Uint8Array(
      await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ff0000' } })
        .png()
        .toBuffer(),
    );

    const result = await composeOverlay(image, { headline: '', logo, accentColor: '#6d55f0' });

    const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true });
    const corner = (450 * info.width + 450) * info.channels;
    expect([data[corner], data[corner + 1], data[corner + 2]]).toEqual([255, 0, 0]);
  });

  it('renders an overlong, emoji and right-to-left headline without throwing', async () => {
    const headline = `${'Long headline '.repeat(40)} 🎉 مرحبا بالعالم שלום עולם`;

    const result = await composeOverlay(await solid(640, 800), { headline, accentColor: '#6d55f0' });

    const meta = await sharp(result).metadata();
    expect([meta.width, meta.height]).toEqual([640, 800]);
  });

  it('fits a tall logo inside the image', async () => {
    const logo = new Uint8Array(
      await sharp({ create: { width: 20, height: 400, channels: 3, background: '#ff0000' } })
        .png()
        .toBuffer(),
    );

    const result = await composeOverlay(await solid(300, 200), { headline: '', logo, accentColor: '#6d55f0' });

    expect((await sharp(result).metadata()).height).toBe(200);
  });

  it('bounds a long headline to 120 code points ending in an ellipsis', () => {
    const bounded = Array.from(boundHeadline('é'.repeat(200)));

    expect(bounded).toHaveLength(120);
    expect(bounded.at(-1)).toBe('…');
    expect(boundHeadline('short')).toBe('short');
  });
});
