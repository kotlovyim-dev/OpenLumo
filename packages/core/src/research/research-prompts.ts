import type { Message } from '@openlumo/providers';
import type { CrawlResult } from '../crawl/crawl-site';
import { untrustedContentRule, wrapUntrustedContent } from '../prompts/untrusted-content';
import type { ResearchSource } from './research-schema';

const PAGE_TEXT_LIMIT = 1500;
const PAGE_METADATA_LIMIT = 1000;
const TOTAL_PAGES_LIMIT = 8000;
const BRIEF_LIMIT = 20000;

function siteExcerpts(crawl: CrawlResult): string[] {
  const sections: string[] = [];
  let used = 0;
  for (const page of crawl.pages) {
    const section = wrapUntrustedContent(
      `page ${page.url}`,
      [
        `Title: ${page.title}`,
        `Description: ${page.description}`,
        ...(page.metadata ? [`Metadata:\n${page.metadata.slice(0, PAGE_METADATA_LIMIT)}`] : []),
        page.text.slice(0, PAGE_TEXT_LIMIT),
      ].join('\n'),
    );
    if (used + section.length > TOTAL_PAGES_LIMIT) break;
    sections.push(section);
    used += section.length;
  }
  return sections;
}

export function buildResearchBriefMessages(input: { url: string; crawl: CrawlResult; today: Date }): Message[] {
  const system = [
    `You are a market researcher. Today is ${input.today.toISOString().slice(0, 10)}. Search the web for current information about a business and write a research brief.`,
    'Cover, under one heading each: the name the business trades under; its products and their concrete features; its audience segments, their pain points, buying triggers and objections, and the platforms, communities and publications where they spend time; three to five direct competitors with their website, positioning, strengths and weaknesses compared with this business; and recent changes in the business or its market.',
    'Prefer recent sources. Cite every claim with a link to its source. Say so when something could not be found instead of guessing.',
    untrustedContentRule,
  ].join('\n');
  const user = [`Website: ${input.url}`, 'Pages read from the website:', ...siteExcerpts(input.crawl)].join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildResearchFindingsMessages(input: { url: string; brief: string; sources: ResearchSource[] }): Message[] {
  const system = [
    'You turn a market research brief into structured findings about a business.',
    'Use only what the brief states. Competitors are other businesses, never the business itself. Give each competitor the address of its own website, or an empty string when the brief does not give one.',
    'For sourceUrls use only addresses from the list of sources. Leave a text or list empty when the brief does not support it.',
    untrustedContentRule,
  ].join('\n');
  const sourceList = input.sources.map((source) => `- ${source.url} ${source.title}`).join('\n') || '- none';
  const user = [
    `Website of the business: ${input.url}`,
    wrapUntrustedContent('research brief', input.brief.slice(0, BRIEF_LIMIT)),
    `Sources:\n${sourceList}`,
  ].join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
