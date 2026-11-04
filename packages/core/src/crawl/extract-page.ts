import * as cheerio from 'cheerio';
import { normaliseUrl } from './normalise-url';

export type ExtractedPage = {
  url: string;
  title: string;
  description: string;
  metadata: string;
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

function withoutLinkedDataIds(key: string, value: unknown): unknown {
  return key === '@context' || key === '@id' ? undefined : value;
}

function readStructuredData($: cheerio.CheerioAPI): string[] {
  return $('script[type="application/ld+json"]')
    .map((_, element) => {
      try {
        return JSON.stringify(JSON.parse($(element).text()), withoutLinkedDataIds);
      } catch {
        return undefined;
      }
    })
    .get();
}

function describeHead($: cheerio.CheerioAPI, description: string, openGraph: Record<string, string>): string {
  const metaContent = (name: string) => $(`meta[name="${name}"]`).attr('content')?.trim() || undefined;
  const socialDescriptions = unique([openGraph['og:description']?.trim(), metaContent('twitter:description')]).filter(
    (text) => text !== '' && text !== description,
  );
  const keywords = metaContent('keywords');
  return [
    ...socialDescriptions.map((text) => `Social description: ${text}`),
    ...(keywords ? [`Keywords: ${keywords}`] : []),
    ...readStructuredData($).map((json) => `Structured data: ${json}`),
  ].join('\n');
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

  const description = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const metadata = describeHead($, description, openGraph);

  $('script, style, nav, footer').remove();
  $(BLOCK_ELEMENTS).append(' ');

  return {
    url: pageUrl,
    title: $('title').first().text().trim(),
    description,
    metadata,
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
