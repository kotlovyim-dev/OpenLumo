import { z } from 'zod';
import type { JobName } from './job-names';

const brandPayload = z.object({ brandId: z.uuid() });

const itemPayload = brandPayload.extend({
  itemId: z.uuid(),
  targetVersion: z.number().int().positive(),
});

export const jobPayloads = {
  'brand.crawl': brandPayload,
  'brand.synthesize-dna': brandPayload.extend({ mergeFeedback: z.boolean().optional() }),
  'strategy.create': brandPayload,
  'plan.month': brandPayload,
  'plan.top-up': brandPayload,
  'item.generate': itemPayload.extend({ instruction: z.string().optional() }),
  'item.regenerate': itemPayload,
  'export.bundle': brandPayload,
  'chat.reply': brandPayload,
} as const satisfies Record<JobName, z.ZodType>;

export type JobPayload<N extends JobName> = z.infer<(typeof jobPayloads)[N]>;
