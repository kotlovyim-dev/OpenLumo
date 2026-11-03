import * as cheerio from 'cheerio';
import { normaliseUrl } from './normalise-url';

export type ExtractedPage = {
  url: string;
  title: string;
  description: string;
  text: string;
  links: string[];
  imageUrls: string[];
  logoUrl?: string;
  faviconUrl?: string;
  openGraph: Record<string, string>;
  stylesheetUrls: string[];
  inlineCss: string;
};

const BLOCK_ELEMENTS =
  'p, div, li, ul, ol, section, article, main, header, h1, h2, h3, h4, h5, h6, br, tr, td, th, blockquote';

function resolveUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
}

function unique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== undefined))];
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, element) => {
    const property = $(element).attr('property');
    const content = $(element).attr('content');
    if (property && content !== undefined) openGraph[property] = content;
  });

  const links = unique(
    $('a[href]')
      .map((_, element) => {
        const resolved = resolveUrl($(element).attr('href'), pageUrl);
        if (!resolved || !/^https?:/.test(resolved)) return undefined;
        return normaliseUrl(resolved);
      })
      .get(),
  );

  const images = $('img[src]')
    .map((_, element) => ({
      url: resolveUrl($(element).attr('src'), pageUrl),
      hint: ['src', 'alt', 'class'].map((name) => $(element).attr(name) ?? '').join(' '),
    }))
    .get();

  const faviconUrl = resolveUrl($('link[rel~="icon"]').first().attr('href'), pageUrl);
  const logoUrl =
    images.find((image) => /logo/i.test(image.hint))?.url ??
    faviconUrl ??
    resolveUrl(openGraph['og:image'], pageUrl);

  const stylesheetUrls = unique(
    $('link[rel~="stylesheet"]')
      .map((_, element) => resolveUrl($(element).attr('href'), pageUrl))
      .get(),
  );
  const inlineCss = $('style')
    .map((_, element) => $(element).text())
    .get()
    .join('\n');

  $('script, style, nav, footer').remove();
  $(BLOCK_ELEMENTS).append(' ');

  return {
    url: pageUrl,
    title: $('title').first().text().trim(),
    description: $('meta[name="description"]').attr('content')?.trim() ?? '',
    text: $('body').text().replace(/\s+/g, ' ').trim(),
    links,
    imageUrls: unique(images.map((image) => image.url)),
    ...(logoUrl ? { logoUrl } : {}),
    ...(faviconUrl ? { faviconUrl } : {}),
    openGraph,
    stylesheetUrls,
    inlineCss,
  };
}
