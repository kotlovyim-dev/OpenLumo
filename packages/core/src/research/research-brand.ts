import { addUsage, generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import type { Competitor } from '../brand-dna/brand-dna-schema';
import type { CrawlResult } from '../crawl/crawl-site';
import { buildResearchBriefMessages, buildResearchFindingsMessages } from './research-prompts';
import { type ResearchFindings, type ResearchSource, researchFindingsSchema } from './research-schema';
import { verifyCompetitors } from './verify-competitors';

export const RESEARCH_SEARCH_RESULTS = 8;
export const MAX_COMPETITORS = 5;

export type ResearchInput = {
  url: string;
  crawl: CrawlResult;
  today: Date;
  allowPrivateHosts: boolean;
  signal?: AbortSignal;
};

export type ResearchResult = {
  brief: string;
  sources: ResearchSource[];
  findings: ResearchFindings;
  usage: Usage;
};

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function isWebAddress(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function tidyCompetitors(competitors: Competitor[], ownUrl: string, cited: Set<string>): Competitor[] {
  const ownHostname = hostnameOf(ownUrl);
  return competitors
    .filter((competitor) => competitor.url === '' || hostnameOf(competitor.url) !== ownHostname)
    .slice(0, MAX_COMPETITORS)
    .map((competitor) => ({
      ...competitor,
      url: isWebAddress(competitor.url) ? competitor.url : '',
      sourceUrls: competitor.sourceUrls.filter((url) => cited.has(url)),
    }));
}

export async function researchBrand(brain: LanguageModel, modelId: string, input: ResearchInput): Promise<ResearchResult> {
  const briefResult = await brain.complete({
    model: modelId,
    messages: buildResearchBriefMessages(input),
    webSearch: { maxResults: RESEARCH_SEARCH_RESULTS },
    signal: input.signal,
  });
  const brief = briefResult.text;
  const sources = briefResult.citations ?? [];
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildResearchFindingsMessages({ url: input.url, brief, sources }),
    schema: researchFindingsSchema,
    schemaName: 'brand_research',
    signal: input.signal,
  });
  const cited = new Set(sources.map((source) => source.url));
  const competitors = await verifyCompetitors(tidyCompetitors(value.competitors, input.url, cited), {
    allowPrivateHosts: input.allowPrivateHosts,
  });
  return { brief, sources, findings: { ...value, competitors }, usage: addUsage(briefResult.usage, usage) };
}
