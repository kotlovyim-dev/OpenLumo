export const jobNames = [
  'brand.crawl',
  'brand.research',
  'brand.synthesize-dna',
  'strategy.create',
  'plan.month',
  'plan.top-up',
  'item.generate',
  'item.regenerate',
  'export.bundle',
  'chat.reply',
] as const;

export type JobName = (typeof jobNames)[number];
