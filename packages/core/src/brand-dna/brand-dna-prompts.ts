import type { Message } from '@openlumo/providers';
import type { CrawlResult } from '../crawl/crawl-site';
import type { BrandDna } from './brand-dna-schema';
import { untrustedContentRule, wrapUntrustedContent } from '../prompts/untrusted-content';

const PAGE_TEXT_LIMIT = 3000;
const PAGE_META_LIMIT = 300;
const TOTAL_PAGES_LIMIT = 20000;

const systemPrompt = [
  'You are a brand strategist. Read the pages of a business website and describe its brand as a structured Brand DNA object.',
  'Fill every field. Tone scales run from 0 to 10. Use hex colours for the palette. Use BCP 47 codes for languages. Leave competitors empty unless the pages name them.',
  untrustedContentRule,
].join('\n');

export function buildBrandDnaMessages(crawl: CrawlResult, feedback: string[]): Message[] {
  const sections: string[] = [];
  let used = 0;
  for (const page of crawl.pages) {
    const section = wrapUntrustedContent(
      `page ${page.url}`,
      [
        `Title: ${page.title.slice(0, PAGE_META_LIMIT)}`,
        `Description: ${page.description.slice(0, PAGE_META_LIMIT)}`,
        page.text.slice(0, PAGE_TEXT_LIMIT),
      ].join('\n'),
    );
    if (used + section.length > TOTAL_PAGES_LIMIT) break;
    sections.push(section);
    used += section.length;
  }
  if (crawl.palette.length > 0) sections.push(`Colours found in the site CSS: ${crawl.palette.join(', ')}`);
  if (feedback.length > 0) {
    sections.push(`Feedback from the brand owner to respect:\n${feedback.map((note) => `- ${note}`).join('\n')}`);
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: sections.join('\n\n') },
  ];
}

export function buildMergeFeedbackMessages(dna: BrandDna, notes: string[]): Message[] {
  const system = [
    'You are a brand strategist. Update an existing Brand DNA object so it reflects feedback from the brand owner.',
    'Return the complete updated Brand DNA object. Change only what the feedback implies and keep every other field as it is.',
  ].join('\n');
  const user = [
    `Current Brand DNA:\n${JSON.stringify(dna)}`,
    `Feedback from the brand owner:\n${notes.map((note) => `- ${note}`).join('\n')}`,
  ].join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
