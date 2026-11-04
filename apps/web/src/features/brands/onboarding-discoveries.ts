import type { BrandResearch } from '@openlumo/core';

export type OnboardingStage = 0 | 1 | 2 | 3;

export type OnboardingDiscoveries = {
  host: string;
  stage: OnboardingStage;
  logoUrl?: string;
  pages: string[];
  palette: string[];
  research: { finished: boolean; sourceCount: number; sources: string[]; competitors: string[] } | null;
};

type SavedCrawl = { pages: { url: string; title: string }[]; palette: string[]; logoAssetId?: string };

function hostnameOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function webSources<T extends { url: string }>(sources: T[]): T[] {
  return sources.filter((source) => hostnameOf(source.url) !== undefined);
}

function pageLabel({ url, title }: { url: string; title: string }): string {
  const lead = title.split(/\s+[|\-–—·]\s+/)[0]?.trim();
  if (lead) return lead;
  try {
    const path = new URL(url).pathname;
    return path === '/' ? 'Home' : path;
  } catch {
    return url;
  }
}

export function describeDiscoveries(
  url: string,
  crawl: SavedCrawl | null,
  research: BrandResearch | null,
): OnboardingDiscoveries {
  const sources = webSources(research?.sources ?? []);
  return {
    host: hostnameOf(url) ?? url,
    stage: research ? 2 : crawl ? 1 : 0,
    ...(crawl?.logoAssetId ? { logoUrl: `/api/assets/${crawl.logoAssetId}` } : {}),
    pages: crawl?.pages.map(pageLabel) ?? [],
    palette: crawl?.palette ?? [],
    research: research && {
      finished: research.status === 'succeeded',
      sourceCount: sources.length,
      sources: [...new Set(sources.flatMap((source) => hostnameOf(source.url) ?? []))],
      competitors: research.findings?.competitors.map((competitor) => competitor.name) ?? [],
    },
  };
}
