import robotsParser from 'robots-parser';
import { extractCssColors } from './css-colors';
import { type ExtractedPage, extractPage } from './extract-page';
import { normaliseUrl } from './normalise-url';
import { safeFetch } from './safe-fetch';

const USER_AGENT = 'OpenLumoBot';
const CONCURRENCY = 3;

export type CrawlResult = {
  pages: ExtractedPage[];
  palette: string[];
  logo?: { url: string; bytes: Uint8Array; mimeType: string };
};

type CrawlOptions = { allowPrivateHosts: boolean; maxPages?: number };

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += CONCURRENCY) {
    results.push(...(await Promise.all(items.slice(start, start + CONCURRENCY).map(run))));
  }
  return results;
}

async function fetchRobots(origin: string, allowPrivateHosts: boolean) {
  try {
    const response = await safeFetch(`${origin}/robots.txt`, { allowPrivateHosts });
    if (response.status !== 200) return undefined;
    return robotsParser(`${origin}/robots.txt`, new TextDecoder().decode(response.body));
  } catch {
    return undefined;
  }
}

async function fetchPage(url: string, allowPrivateHosts: boolean): Promise<ExtractedPage> {
  const response = await safeFetch(url, { allowPrivateHosts });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Unexpected status ${response.status} for ${url}`);
  }
  if (!/html/i.test(response.contentType)) {
    throw new Error(`Not an HTML page: ${url}`);
  }
  return extractPage(new TextDecoder().decode(response.body), response.finalUrl);
}

async function fetchStylesheet(url: string, allowPrivateHosts: boolean): Promise<string> {
  try {
    const response = await safeFetch(url, { allowPrivateHosts });
    return response.status === 200 ? new TextDecoder().decode(response.body) : '';
  } catch {
    return '';
  }
}

async function fetchLogo(url: string, allowPrivateHosts: boolean): Promise<CrawlResult['logo']> {
  try {
    const response = await safeFetch(url, { allowPrivateHosts });
    const mimeType = response.contentType.split(';')[0]?.trim() ?? '';
    if (response.status !== 200 || !mimeType.startsWith('image/')) return undefined;
    return { url: response.finalUrl, bytes: response.body, mimeType };
  } catch {
    return undefined;
  }
}

export async function crawlSite(startUrl: string, options: CrawlOptions): Promise<CrawlResult> {
  const { allowPrivateHosts, maxPages = 10 } = options;
  const first = await fetchPage(startUrl, allowPrivateHosts);
  const origin = new URL(first.url).origin;
  const robots = await fetchRobots(origin, allowPrivateHosts);
  const isAllowed = (url: string) => robots?.isAllowed(url, USER_AGENT) !== false;

  if (!isAllowed(first.url)) throw new Error(`robots.txt disallows ${first.url}`);

  const pages: ExtractedPage[] = [first];
  const seen = new Set([normaliseUrl(startUrl), normaliseUrl(first.url)]);
  const crawled = new Set([normaliseUrl(first.url)]);
  let queue: string[] = [];

  const enqueueLinks = (page: ExtractedPage) => {
    for (const link of page.links) {
      if (new URL(link).origin === origin && !seen.has(link) && isAllowed(link)) {
        seen.add(link);
        queue.push(link);
      }
    }
  };
  enqueueLinks(first);

  while (queue.length > 0 && pages.length < maxPages) {
    const batch = queue.slice(0, Math.min(CONCURRENCY, maxPages - pages.length));
    queue = queue.slice(batch.length);
    const settled = await Promise.allSettled(batch.map((url) => fetchPage(url, allowPrivateHosts)));
    for (const result of settled) {
      if (result.status === 'rejected') continue;
      const page = result.value;
      const finalUrl = normaliseUrl(page.url);
      if (new URL(finalUrl).origin !== origin || crawled.has(finalUrl)) continue;
      crawled.add(finalUrl);
      pages.push(page);
      enqueueLinks(page);
    }
  }

  const stylesheetUrls = [
    ...new Set(
      pages.flatMap((page) => page.stylesheetUrls).filter((url) => new URL(url).origin === origin),
    ),
  ];
  const stylesheets = await inBatches(stylesheetUrls, (url) =>
    fetchStylesheet(url, allowPrivateHosts),
  );
  const css = [...pages.map((page) => page.inlineCss), ...stylesheets].join('\n');

  const logoUrl = pages.find((page) => page.logoUrl)?.logoUrl;
  const logo = logoUrl ? await fetchLogo(logoUrl, allowPrivateHosts) : undefined;

  return { pages, palette: extractCssColors(css), ...(logo ? { logo } : {}) };
}
