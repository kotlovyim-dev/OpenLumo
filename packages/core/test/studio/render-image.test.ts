import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { toPng } from '../../src/studio/render-image';

describe('toPng', () => {
  it('converts a JPEG into a PNG', async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#808080' } })
      .jpeg()
      .toBuffer();

    const png = await toPng(new Uint8Array(jpeg));

    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
