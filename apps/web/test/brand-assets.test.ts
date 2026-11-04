import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { SpotName } from '@/components/empty-state';

const brandDirectory = join(import.meta.dirname, '../public/brand');

const spots: Record<SpotName, true> = {
  'setup-welcome': true,
  'reading-site': true,
  'needs-input': true,
  'empty-board': true,
  exported: true,
  'not-found': true,
};

const palette = [
  '#F1EDFF',
  '#CBBFFF',
  '#9F8CF0',
  '#26204A',
  '#FF9BB8',
  '#FF5F7E',
  '#FFB347',
  '#FFE156',
  '#3FD68F',
  '#4AA3FF',
  '#FFFFFF',
  '#0B0A12',
];

const svgFiles = existsSync(brandDirectory)
  ? readdirSync(brandDirectory, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.svg'))
  : [];

const readSvg = (file: string) => readFileSync(join(brandDirectory, file), 'utf8');

describe('brand assets', () => {
  it('has a spot for every spot name', () => {
    for (const spot of Object.keys(spots)) {
      expect(existsSync(join(brandDirectory, 'spots', `${spot}.svg`)), spot).toBe(true);
    }
  });

  it('has the logo files', () => {
    for (const file of ['lumo-mark.svg', 'openlumo-wordmark.svg', 'favicon.svg', 'favicon-32.png', 'icon-512.png']) {
      expect(existsSync(join(brandDirectory, 'logo', file)), file).toBe(true);
    }
  });

  it.each(svgFiles)('%s parses and has a viewBox', async (file) => {
    const metadata = await sharp(join(brandDirectory, file)).metadata();
    expect(metadata.format).toBe('svg');
    expect(readSvg(file)).toMatch(/<svg[^>]*\sviewBox="[\d.\s-]+"/);
  });

  it.each(svgFiles)('%s has no scripts or external references', (file) => {
    const svg = readSvg(file);
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/href="(?!#)/);
    expect(svg).not.toMatch(/url\((?!#)/);
  });

  it.each(svgFiles)('%s only uses palette colours', (file) => {
    const svg = readSvg(file);
    const hexColours = svg.match(/#[0-9a-f]{3,8}(?![\w-])/gi) ?? [];
    const paints = [...svg.matchAll(/(?:fill|stroke|stop-color|color)(?:="|:\s*)([^";}]+)/g)].map((match) => match[1]!.trim());
    for (const colour of hexColours) expect(palette, colour).toContain(colour.toUpperCase());
    for (const paint of paints) expect(paint, paint).toMatch(/^(none|url\(#[\w-]+\)|#[0-9a-f]{6})$/i);
  });
});
