import type { Message } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { Channel, ItemFormat } from '../planner/channel-formats';
import { untrustedContentRule } from '../prompts/untrusted-content';
import { writingRules } from '../prompts/writing-rules';
import { adRules } from './ad-guidance';
import { aspectRatioFor } from './aspect-ratio';
import { channelGuidance } from './channel-guidance';
import { formatGuidance } from './format-guidance';
import { imageBriefRules } from './image-brief-rules';

export type CopyInput = {
  dna: BrandDna;
  feedback: string[];
  item: { channel: Channel; format: ItemFormat; pillar: string; angle: string };
  instruction?: string;
  language: string;
};

const imageFormats: ItemFormat[] = ['social_post', 'carousel', 'static_ad'];

export function copyRules(channel: Channel, format: ItemFormat): string {
  const sections = [
    format === 'static_ad' ? `Ad rules for ${channel}:\n${adRules(channel)}` : `Rules for ${channel}:\n${channelGuidance[channel]}`,
    `Rules for the ${format} format:\n${formatGuidance[format]}`,
  ];
  if (imageFormats.includes(format)) sections.push(`Image brief rules:\n${imageBriefRules(aspectRatioFor(channel))}`);
  return sections.join('\n\n');
}

export function buildCopyMessages(input: CopyInput): Message[] {
  const { item } = input;
  const system = [
    'You are a brand copywriter. Write marketing copy as a structured object that matches the requested format.',
    `Write in the language with BCP 47 code "${input.language}". Follow the brand voice.`,
    untrustedContentRule,
    'The pillar and the angle give the direction, never facts: take facts only from the Brand DNA and the instruction.',
    `Writing rules:\n${writingRules}`,
    copyRules(item.channel, item.format),
  ].join('\n\n');
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
