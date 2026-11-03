import type { TextRequest } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import { channelFormats, type Channel } from '../planner/channel-formats';
import type { StrategyDocument } from '../planner/strategy-schema';

const sunriseBakeryDna: BrandDna = {
  identity: {
    name: 'Sunrise Bakery',
    tagline: 'Fresh bread, baked before the sun is up.',
    offering: 'Handmade bread and pastries baked every morning for the neighbourhood.',
    products: ['Sourdough loaf', 'Butter croissant', 'Weekly bread subscription'],
  },
  audience: {
    segments: ['Local families', 'Busy commuters', 'Cafes needing a morning supplier'],
    painPoints: ['Supermarket bread tastes stale', 'No time to shop in the morning'],
    buyingTriggers: ['Weekend breakfast', 'Running low on bread'],
    objections: ['Handmade bread costs more'],
  },
  voice: {
    tone: { formalToCasual: 8, seriousToPlayful: 6, reservedToBold: 4 },
    dos: ['Sound warm and neighbourly', 'Mention freshness'],
    donts: ['Use corporate jargon'],
    samplePhrases: ['Still warm from the oven.', 'Baked for your street.'],
  },
  visuals: {
    palette: ['#d97706', '#fef3c7', '#451a03'],
    typography: 'Friendly rounded serif headings with a clean sans-serif body',
    imageStyle: 'Warm natural light, close-up bread on wooden tables',
  },
  competitors: [],
  languages: ['en'],
};

const DAY_MS = 86_400_000;

function requestText(request: TextRequest): string {
  return request.messages.map((message) => message.content).join('\n');
}

function requestedChannels(request: TextRequest): Channel[] {
  const text = requestText(request);
  const line = /^Channels: (.+)$/m.exec(text)?.[1] ?? 'instagram';
  return line.split(', ') as Channel[];
}

function strategyFor(request: TextRequest): StrategyDocument {
  return {
    strengths: ['Loyal local following', 'Distinctive handmade product'],
    gaps: ['Inconsistent posting', 'No email list'],
    pillars: [
      { name: 'Behind the scenes', description: 'The people and process behind each bake.' },
      { name: 'Product spotlight', description: 'One product, shown at its best.' },
    ],
    cadence: requestedChannels(request).map((channel) => ({ channel, postsPerWeek: 3 })),
    campaignIdeas: [
      { title: 'Early bird', summary: 'Reward the first customers of the day.' },
      { title: 'Neighbourhood stories', summary: 'Feature regulars and their favourites.' },
      { title: 'Seasonal loaf', summary: 'A limited loaf for each season.' },
    ],
  };
}

function contentPlanFor(request: TextRequest) {
  const text = requestText(request);
  const [from, to] = /^Window: (\S+) to (\S+)$/m.exec(text)?.slice(1) ?? [];
  const channels = requestedChannels(request);
  const start = Date.parse(from!);
  const end = Date.parse(to!);
  const slots = [];
  for (let offset = 1; start + offset * DAY_MS < end; offset += 2) {
    const channel: Channel = channels[slots.length % channels.length]!;
    slots.push({
      channel,
      format: channelFormats[channel][0]!,
      pillar: slots.length % 2 === 0 ? 'Behind the scenes' : 'Product spotlight',
      angle: `Angle ${slots.length + 1}`,
      date: new Date(start + offset * DAY_MS).toISOString().slice(0, 10),
    });
  }
  return { slots };
}

export const fakeResponses: Record<string, (request: TextRequest) => unknown> = {
  brand_dna: () => sunriseBakeryDna,
  strategy: strategyFor,
  content_plan: contentPlanFor,
};

export const defaultFakeReply = 'ok';
