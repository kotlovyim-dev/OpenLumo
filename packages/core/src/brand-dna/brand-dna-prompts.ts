import type { Message } from '@openlumo/providers';
import type { CrawlResult } from '../crawl/crawl-site';
import { untrustedContentRule, wrapUntrustedContent } from '../prompts/untrusted-content';

const PAGE_TEXT_LIMIT = 3000;

const systemPrompt = [
  'You are a brand strategist. Read the pages of a business website and describe its brand as a structured Brand DNA object.',
  'Fill every field. Tone scales run from 0 to 10. Use hex colours for the palette. Use BCP 47 codes for languages. Leave competitors empty unless the pages name them.',
  untrustedContentRule,
].join('\n');

export function buildBrandDnaMessages(crawl: CrawlResult, feedback: string[]): Message[] {
  const sections = crawl.pages.map((page) =>
    wrapUntrustedContent(
      `page ${page.url}`,
      [`Title: ${page.title}`, `Description: ${page.description}`, page.text.slice(0, PAGE_TEXT_LIMIT)].join('\n'),
    ),
  );
  if (crawl.palette.length > 0) sections.push(`Colours found in the site CSS: ${crawl.palette.join(', ')}`);
  if (feedback.length > 0) {
    sections.push(`Feedback from the brand owner to respect:\n${feedback.map((note) => `- ${note}`).join('\n')}`);
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: sections.join('\n\n') },
  ];
}
