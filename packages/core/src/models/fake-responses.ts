import { DAY_MS } from '../time';
import type { TextRequest } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { ResearchFindings } from '../research/research-schema';
import { channelFormats, type Channel } from '../planner/channel-formats';
import type { StrategyDocument } from '../planner/strategy-schema';
import type { BlogPostCopy, CarouselCopy, EmailCopy, SocialPostCopy, StaticAdCopy } from '../studio/format-schemas';

const sunriseBakeryDna: BrandDna = {
  identity: {
    name: 'Sunrise Bakery',
    tagline: 'Fresh bread, baked before the sun is up.',
    offering: 'Handmade bread and pastries baked every morning for the neighbourhood.',
    products: ['Sourdough loaf', 'Butter croissant', 'Weekly bread subscription'],
    features: ['Baked fresh before 6am', 'Weekly delivery to your door'],
  },
  audience: {
    segments: ['Local families', 'Busy commuters', 'Cafes needing a morning supplier'],
    painPoints: ['Supermarket bread tastes stale', 'No time to shop in the morning'],
    buyingTriggers: ['Weekend breakfast', 'Running low on bread'],
    objections: ['Handmade bread costs more'],
    channels: ['Neighbourhood Facebook groups', 'Instagram'],
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

const sunriseResearchFindings: ResearchFindings = {
  name: 'Sunrise Bakery',
  features: ['Baked fresh before 6am', 'Weekly delivery to your door', 'Pre-order online by 8pm'],
  audience: {
    segments: ['Local families', 'Busy commuters', 'Cafes needing a morning supplier'],
    painPoints: ['Supermarket bread tastes stale', 'No time to shop in the morning'],
    buyingTriggers: ['Weekend breakfast', 'Running low on bread'],
    objections: ['Handmade bread costs more'],
    channels: ['Neighbourhood Facebook groups', 'Instagram', 'Local food blogs'],
  },
  competitors: [
    {
      name: 'Golden Crust Bakery',
      url: '',
      positioning: 'A bakery chain with low prices and long opening hours.',
      strengths: ['Many locations'],
      weaknesses: ['Bread is baked off-site'],
      sourceUrls: ['https://example.com/sunrise-bakery-review'],
    },
  ],
};

export const fakeResearchBrief =
  'Sunrise Bakery is a neighbourhood bakery known for bread baked before 6am [example.com](https://example.com/sunrise-bakery-review).';

export const fakeResearchSources = [{ url: 'https://example.com/sunrise-bakery-review', title: 'Sunrise Bakery review' }];

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

function imageBrief(request: TextRequest, subject: string) {
  const instruction = /^Instruction: (.+)$/m.exec(requestText(request))?.[1];
  return { prompt: instruction ? `${subject} ${instruction}` : subject, headlineOverlay: 'Fresh every morning' };
}

function socialPostCopy(request: TextRequest): SocialPostCopy {
  return {
    caption: 'Still warm from the oven. Come say hello before the sun is up.',
    hashtags: ['#sunrisebakery', '#freshbread'],
    imageBrief: imageBrief(request, 'A golden sourdough loaf on a wooden table in warm morning light.'),
  };
}

function carouselCopy(request: TextRequest): CarouselCopy {
  return {
    slides: ['Mix', 'Shape', 'Bake'].map((title) => ({
      title,
      text: `${title} the dough with care.`,
      imageBrief: imageBrief(request, `A baker's hands during the ${title.toLowerCase()} step in warm light.`),
    })),
    caption: 'From dough to loaf, the way we do it every morning.',
  };
}

function staticAdCopy(request: TextRequest): StaticAdCopy {
  return {
    headline: 'Bread worth waking up for',
    primaryText: 'Handmade loaves baked every morning for your street.',
    callToAction: 'Order today',
    imageBrief: imageBrief(request, 'A basket of fresh loaves beside a window at sunrise.'),
  };
}

const emailCopy: EmailCopy = {
  subject: 'Fresh from the oven this week',
  preheader: 'Our new seasonal loaf is here.',
  body: 'Hello neighbour,\n\nThis week we baked a new seasonal loaf. Come by before noon while it is still warm.\n\nSunrise Bakery',
};

const blogPostCopy: BlogPostCopy = {
  seoTitle: 'How to keep sourdough fresh for a week',
  metaDescription: 'Simple storage tips to keep a handmade sourdough loaf fresh for days.',
  outline: ['Why sourdough keeps well', 'Where to store it', 'How to revive a stale loaf'],
  article:
    'Sourdough keeps longer than most bread. Store it cut side down on a board, then wrap it in cloth once cool. To revive a stale loaf, sprinkle it with water and warm it in the oven.',
  faq: [{ question: 'Can I freeze sourdough?', answer: 'Yes. Slice it first and freeze the slices in a sealed bag.' }],
};

export const fakeResponses: Record<string, (request: TextRequest) => unknown> = {
  brand_dna: () => sunriseBakeryDna,
  brand_research: () => sunriseResearchFindings,
  merged_brand_dna: () => sunriseBakeryDna,
  strategy: strategyFor,
  content_plan: contentPlanFor,
  copy_social_post: socialPostCopy,
  copy_carousel: carouselCopy,
  copy_static_ad: staticAdCopy,
  copy_email: () => emailCopy,
  copy_blog_post: () => blogPostCopy,
};

export function fakeChatReply(request: TextRequest): string {
  const question = request.messages.findLast((message) => message.role === 'user')?.content ?? '';
  return `Lumo here. You asked: "${question}". Lead with freshness and post early in the morning.`;
}

export const defaultFakeReply = 'ok';
