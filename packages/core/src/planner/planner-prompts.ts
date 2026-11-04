import { DAY_MS } from '../time';
import type { Message } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import { channelFormats, type Channel } from './channel-formats';
import { defaultCadence } from './default-cadence';
import type { PlannedSlot } from './plan-schema';
import type { Goal, StrategyDocument } from './strategy-schema';

const strategySystemPrompt = [
  'You are a marketing strategist. Audit the brand and write a content strategy as a structured object.',
  'List strengths and gaps, name content pillars, set a posting cadence per requested channel, and propose three to five campaign ideas.',
  'Make strengths and gaps specific to this brand by naming what the Brand DNA shows or lacks.',
  'Name 3 to 5 pillars after customer problems taken from the audience pain points and buying triggers, never after company departments. Each pillar description gives a one-line promise to the audience and names 2 or 3 recurring series with a fixed name and structure, such as "Myth Monday", "Teardown" or "Customer of the month".',
  'Plan a mix of about 70% value (teach, entertain, inspire), 20% community and brand story (people, behind the scenes, customers) and at most 10% direct promotion.',
  'Start from the default cadence of each channel and adjust it to the goal.',
  'Build each campaign idea on one pattern: a contrarian take on an industry norm, a before and after, behind the scenes, one number explained, a customer story with a specific result, a challenge over a set number of days, a mistake or lesson, a comparison, or a seasonal hook tied to a real offer.',
  'Make the first campaign idea the hero idea that every requested channel carries in its own native form, and say how in its summary.',
  'Make every idea specific enough that no competitor could run it unchanged. Skip viral trends, politics and tragedies.',
  'Use only facts, numbers, customers and results stated in the Brand DNA; never invent them. Use the number and customer-story patterns only when the DNA has the fact.',
].join('\n');

const planSystemPrompt = [
  'You are a content planner. Plan content items for the requested window as a structured object.',
  'Every slot needs a channel from the strategy, a format allowed for that channel, a pillar, a concrete angle, a date as YYYY-MM-DD inside the window and an optional time as HH:MM in UTC.',
  'Follow the cadence per channel, spread the items across the window, rotate pillars and do not repeat the already planned items.',
  'Keep every channel at about 70% value, 20% community and story and at most 10% promotion, and never put two promotional items in a row on one channel.',
  'In the window, include at least one episode of a named series per channel; one hero idea repurposed across at least three channels, or every channel when there are fewer; one proof item built on a customer or result from the Brand DNA when it has one; and one behind-the-scenes or people item.',
  'Write every angle as a concrete one-line brief naming the product, customer problem, number, place or step it is about, specific enough that no competitor could post it unchanged. Never write a generic topic such as "Tips for success" or "Behind the scenes".',
  'Give a shared idea a different angle on each channel that fits how people use that platform, and never reuse an angle word for word.',
  'Prefer carousels for teaching posts on Instagram and LinkedIn.',
  'Schedule on weekdays, favouring Tuesday to Thursday, avoid Sundays, and never put two items of one channel on the same day.',
  'Leave about one slot in ten of the cadence free for timely posts.',
  'Use only facts, numbers, customers and results stated in the Brand DNA; never invent them. Use the number and customer-story patterns only when the DNA has the fact.',
].join('\n');

export function buildStrategyMessages(dna: BrandDna, goal: Goal, channels: Channel[]): Message[] {
  const cadence = channels.map((name) => `${name}: ${defaultCadence[name]}`).join('\n');
  return [
    { role: 'system', content: strategySystemPrompt },
    {
      role: 'user',
      content: [
        `Goal: ${goal}`,
        `Channels: ${channels.join(', ')}`,
        `Default cadence:\n${cadence}`,
        `Brand DNA:\n${JSON.stringify(dna)}`,
      ].join('\n\n'),
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
