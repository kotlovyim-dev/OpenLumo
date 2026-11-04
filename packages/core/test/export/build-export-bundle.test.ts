import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { buildExportBundle, type ExportableItem } from '../../src/export/build-export-bundle';
import { slugify } from '../../src/export/slugify';

const dna = createPartialBrandDna({ name: 'Acme', palette: [] });
const storage = {
  write: async () => {},
  read: async (key: string) => new TextEncoder().encode(`bytes:${key}`),
  path: (key: string) => key,
};
const social = (id: string, caption: string, scheduledAt: Date | null): ExportableItem => ({
  id,
  channel: 'instagram',
  format: 'social_post',
  scheduledAt,
  dna,
  imageKeys: ['k/one.png'],
  copy: { caption, hashtags: ['a', 'b'], imageBrief: { prompt: 'p' } },
});

describe('slugify', () => {
  it('lowercases, transliterates Cyrillic, bounds length and falls back', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Привіт світ')).toBe('pryvit-svit');
    expect(slugify('x'.repeat(100))).toHaveLength(60);
    expect(slugify('!!!')).toBe('item');
  });
});

describe('buildExportBundle', () => {
  it('produces folders, files, images and a calendar', async () => {
    const items: ExportableItem[] = [
      social('1', 'Launch day', new Date('2026-12-01T09:00:00Z')),
      {
        id: '2',
        channel: 'email',
        format: 'email',
        scheduledAt: null,
        dna,
        imageKeys: [],
        copy: { subject: 'News', preheader: '', body: 'Hi' },
      },
      {
        id: '3',
        channel: 'blog',
        format: 'blog_post',
        scheduledAt: new Date('2026-12-03T09:00:00Z'),
        dna,
        imageKeys: [],
        copy: { seoTitle: 'Post', metaDescription: 'd', outline: ['o'], article: 'A', faq: [] },
      },
    ];
    const files = unzipSync(await buildExportBundle(items, storage));
    expect(Object.keys(files).sort()).toEqual([
      '2026-12-01-instagram-launch-day/copy.txt',
      '2026-12-01-instagram-launch-day/image-1.png',
      '2026-12-03-blog-post/post.md',
      'calendar.ics',
      'unscheduled-email-news/email.html',
    ]);
    expect(strFromU8(files['2026-12-01-instagram-launch-day/copy.txt']!)).toContain('Launch day');
    expect(strFromU8(files['2026-12-01-instagram-launch-day/image-1.png']!)).toBe('bytes:k/one.png');
    const ics = strFromU8(files['calendar.ics']!);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).not.toContain('2@openlumo');
  });

  it('keeps folder names unique', async () => {
    const at = new Date('2026-12-01T09:00:00Z');
    const files = unzipSync(await buildExportBundle([social('1', 'Same', at), social('2', 'Same', at), social('3', 'Same', at)], storage));
    const folders = new Set(Object.keys(files).filter((n) => n.endsWith('copy.txt')).map((n) => n.split('/')[0]));
    expect(folders).toEqual(new Set(['2026-12-01-instagram-same', '2026-12-01-instagram-same-2', '2026-12-01-instagram-same-3']));
  });
});
