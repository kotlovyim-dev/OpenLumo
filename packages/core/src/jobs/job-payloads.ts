import { z } from 'zod';
import { channelSchema } from '../planner/channel-formats';
import { goalSchema } from '../planner/strategy-schema';
import type { JobName } from './job-names';

const brandPayload = z.object({ brandId: z.uuid() });

const itemPayload = brandPayload.extend({
  itemId: z.uuid(),
  targetVersion: z.number().int().positive(),
});

export const jobPayloads = {
  'brand.crawl': brandPayload,
  'brand.research': brandPayload.extend({ refresh: z.boolean().optional() }),
  'brand.synthesize-dna': brandPayload.extend({ mergeFeedback: z.boolean().optional() }),
  'strategy.create': brandPayload.extend({ goal: goalSchema, channels: z.array(channelSchema).min(1) }),
  'plan.month': brandPayload.extend({
    strategyId: z.uuid(),
    from: z.iso.datetime(),
    days: z.number().int().positive(),
  }),
  'plan.top-up': brandPayload,
  'item.generate': itemPayload.extend({ instruction: z.string().optional() }),
  'item.regenerate': itemPayload.extend({
    scope: z.enum(['copy', 'image', 'all']),
    feedback: z.string().optional(),
  }),
  'export.bundle': brandPayload.extend({ itemIds: z.array(z.uuid()).min(1).max(200) }),
  'chat.reply': brandPayload.extend({ messageId: z.uuid() }),
} as const satisfies Record<JobName, z.ZodType>;

export type JobPayload<N extends JobName> = z.infer<(typeof jobPayloads)[N]>;
