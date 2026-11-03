import type { Message } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { Channel, ItemFormat } from '../planner/channel-formats';

export type CopyInput = {
  dna: BrandDna;
  feedback: string[];
  item: { channel: Channel; format: ItemFormat; pillar: string; angle: string };
  instruction?: string;
  language: string;
};

const formatGuidance: Record<ItemFormat, string> = {
  social_post: 'Write a caption, a list of hashtags and one image brief describing the picture to render.',
  carousel:
    'Write 2 to 5 slides, each with a title, a short text and its own image brief, plus a caption for the whole carousel.',
  static_ad: 'Write a headline, primary text, a call to action and one image brief describing the picture to render.',
  email: 'Write a subject line, a preheader and the email body.',
  blog_post: 'Write an SEO title, a meta description, an outline, the full article and an FAQ.',
};

export function buildCopyMessages(input: CopyInput): Message[] {
  const { item } = input;
  const system = [
    'You are a brand copywriter. Write marketing copy as a structured object that matches the requested format.',
    `Write in the language with BCP 47 code "${input.language}". Follow the brand voice. Image briefs describe the picture only and must not ask for text inside the image.`,
    formatGuidance[item.format],
  ].join('\n');
  const sections = [
    `Channel: ${item.channel}`,
    `Format: ${item.format}`,
    `Pillar: ${item.pillar}`,
    `Angle: ${item.angle}`,
    `Brand DNA:\n${JSON.stringify(input.dna)}`,
  ];
  if (input.feedback.length > 0) {
    sections.push(`Feedback from the brand owner to respect:\n${input.feedback.map((note) => `- ${note}`).join('\n')}`);
  }
  if (input.instruction) sections.push(`Instruction: ${input.instruction}`);
  return [
    { role: 'system', content: system },
    { role: 'user', content: sections.join('\n\n') },
  ];
}
