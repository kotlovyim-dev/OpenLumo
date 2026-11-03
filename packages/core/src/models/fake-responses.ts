import type { TextRequest } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';

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

export const fakeResponses: Record<string, (request: TextRequest) => unknown> = {
  brand_dna: () => sunriseBakeryDna,
};

export const defaultFakeReply = 'ok';
