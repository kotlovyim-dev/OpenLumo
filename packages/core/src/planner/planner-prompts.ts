import type { Message } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import { channelFormats, type Channel } from './channel-formats';
import type { PlannedSlot } from './plan-schema';
import type { Goal, StrategyDocument } from './strategy-schema';

const DAY_MS = 86_400_000;

const strategySystemPrompt = [
  'You are a marketing strategist. Audit the brand and write a content strategy as a structured object.',
  'List strengths and gaps, name content pillars, set a posting cadence per requested channel, and propose three to five campaign ideas.',
].join('\n');

const planSystemPrompt = [
  'You are a content planner. Plan content items for the requested window as a structured object.',
  'Every slot needs a channel from the strategy, a format allowed for that channel, a pillar, a concrete angle, a date as YYYY-MM-DD inside the window and an optional time as HH:MM in UTC.',
  'Follow the cadence per channel, spread the items across the window, rotate pillars and do not repeat the already planned items.',
].join('\n');

export function buildStrategyMessages(dna: BrandDna, goal: Goal, channels: Channel[]): Message[] {
  return [
    { role: 'system', content: strategySystemPrompt },
    {
      role: 'user',
      content: [`Goal: ${goal}`, `Channels: ${channels.join(', ')}`, `Brand DNA:\n${JSON.stringify(dna)}`].join('\n\n'),
    },
  ];
}

export function buildPlanMessages(input: {
  dna: BrandDna;
  strategy: StrategyDocument;
  from: Date;
  days: number;
  existing: PlannedSlot[];
}): Message[] {
  const to = new Date(input.from.getTime() + input.days * DAY_MS);
  const channels = input.strategy.cadence.map((entry) => entry.channel);
  const allowedFormats = Object.fromEntries(channels.map((name) => [name, channelFormats[name]]));
  const existing = input.existing.map((slot) => ({ ...slot, scheduledAt: slot.scheduledAt.toISOString() }));
  return [
    { role: 'system', content: planSystemPrompt },
    {
      role: 'user',
      content: [
        `Window: ${input.from.toISOString()} to ${to.toISOString()}`,
        `Channels: ${channels.join(', ')}`,
        `Allowed formats: ${JSON.stringify(allowedFormats)}`,
        `Strategy:\n${JSON.stringify(input.strategy)}`,
        `Brand DNA:\n${JSON.stringify(input.dna)}`,
        `Already planned:\n${JSON.stringify(existing)}`,
      ].join('\n\n'),
    },
  ];
}
