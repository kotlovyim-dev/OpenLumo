import { strToU8, zipSync, type Zippable } from 'fflate';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { AssetStorage } from '../assets/asset-storage';
import type { Channel, ItemFormat } from '../planner/channel-formats';
import type {
  BlogPostCopy,
  CarouselCopy,
  EmailCopy,
  FormatCopy,
  SocialPostCopy,
  StaticAdCopy,
} from '../studio/format-schemas';
import { buildCalendarFile, type CalendarItem } from './build-calendar-file';
import { renderBlogMarkdown } from './render-blog-markdown';
import { renderEmailHtml } from './render-email-html';
import { slugify } from './slugify';

export type ExportableItem = {
  id: string;
  channel: Channel;
  format: ItemFormat;
  scheduledAt: Date | null;
  copy: FormatCopy;
  dna: BrandDna;
  imageKeys: string[];
};

function titleOf(item: ExportableItem): string {
  const copy = item.copy;
  switch (item.format) {
    case 'social_post':
      return (copy as SocialPostCopy).caption;
    case 'carousel':
      return (copy as CarouselCopy).slides[0]?.title ?? (copy as CarouselCopy).caption;
    case 'static_ad':
      return (copy as StaticAdCopy).headline;
    case 'email':
      return (copy as EmailCopy).subject;
    case 'blog_post':
      return (copy as BlogPostCopy).seoTitle;
  }
}

function plainText(item: ExportableItem): string {
  const copy = item.copy;
  switch (item.format) {
    case 'social_post': {
      const { caption, hashtags } = copy as SocialPostCopy;
      return [caption, hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')].filter(Boolean).join('\n\n');
    }
    case 'carousel': {
      const { slides, caption } = copy as CarouselCopy;
      const body = slides.map((slide, index) => `Slide ${index + 1}: ${slide.title}\n${slide.text}`);
      return [...body, caption].join('\n\n');
    }
    case 'static_ad': {
      const { headline, primaryText, callToAction } = copy as StaticAdCopy;
      return `${headline}\n\n${primaryText}\n\n${callToAction}`;
    }
    default:
      return titleOf(item);
  }
}

function mainFile(item: ExportableItem): { name: string; content: string } {
  if (item.format === 'email') {
    return { name: 'email.html', content: renderEmailHtml(item.copy as EmailCopy, item.dna) };
  }
  if (item.format === 'blog_post') {
    return { name: 'post.md', content: renderBlogMarkdown(item.copy as BlogPostCopy) };
  }
  return { name: 'copy.txt', content: plainText(item) };
}

function folderBase(item: ExportableItem): string {
  const date = item.scheduledAt?.toISOString().slice(0, 10) ?? 'unscheduled';
  return `${date}-${item.channel}-${slugify(titleOf(item))}`;
}

function uniqueFolder(base: string, taken: Set<string>): string {
  let folder = base;
  for (let suffix = 2; taken.has(folder); suffix++) folder = `${base}-${suffix}`;
  taken.add(folder);
  return folder;
}

export async function buildExportBundle(items: ExportableItem[], storage: AssetStorage): Promise<Uint8Array> {
  const files: Zippable = {};
  const taken = new Set<string>();
  const events: CalendarItem[] = [];

  for (const item of items) {
    const folder = uniqueFolder(folderBase(item), taken);
    const { name, content } = mainFile(item);
    files[`${folder}/${name}`] = strToU8(content);
    for (const [index, key] of item.imageKeys.entries()) {
      files[`${folder}/image-${index + 1}.png`] = [await storage.read(key), { level: 0 }];
    }
    if (item.scheduledAt) {
      events.push({
        id: item.id,
        title: titleOf(item),
        scheduledAt: item.scheduledAt,
        description: `${item.channel} ${item.format}`,
      });
    }
  }

  files['calendar.ics'] = strToU8(buildCalendarFile(events));
  return zipSync(files);
}
