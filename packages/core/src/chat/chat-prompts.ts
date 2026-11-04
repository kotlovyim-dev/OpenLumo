import { channelFormats } from '../planner/channel-formats';
import { untrustedContentRule, wrapUntrustedContent } from '../prompts/untrusted-content';
import type { ChatContext } from './reply-to-chat';

const chatRules = [
  'You are Lumo, the marketing assistant of the brand below. Help the team with ideas, feedback and questions about their brand, strategy and content.',
  'When the team asks for new content, call create_draft with a channel, a format allowed for that channel and a concrete angle. When they ask to change an existing item, call regenerate_item with its id from the recent items and their feedback.',
  'After using a tool, tell the team in one or two sentences what you started. Drafts are written in the background and appear on the board in review.',
  'Reply in plain text without Markdown or HTML, in the language the team writes in.',
  untrustedContentRule,
].join('\n');

export function buildChatSystemPrompt({ dna, strategy, recentItems }: ChatContext): string {
  return [
    chatRules,
    `Allowed formats per channel: ${JSON.stringify(channelFormats)}`,
    `Brand DNA:\n${wrapUntrustedContent('brand_dna', JSON.stringify(dna))}`,
    strategy
      ? `Current strategy:\n${wrapUntrustedContent('strategy', JSON.stringify(strategy))}`
      : 'There is no strategy yet.',
    `Recent items (newest first):\n${wrapUntrustedContent('recent_items', JSON.stringify(recentItems))}`,
  ].join('\n\n');
}
