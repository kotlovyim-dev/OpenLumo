import { z } from 'zod';
import { channelSchema } from './channel-formats';

export const goalSchema = z.enum(['awareness', 'leads', 'sales', 'launch']);

export type Goal = z.infer<typeof goalSchema>;

export const strategyDocumentSchema = z.object({
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  pillars: z.array(z.object({ name: z.string(), description: z.string() })),
  cadence: z.array(z.object({ channel: channelSchema, postsPerWeek: z.number().int().positive() })),
  campaignIdeas: z.array(z.object({ title: z.string(), summary: z.string() })).min(3).max(5),
});

export type StrategyDocument = z.infer<typeof strategyDocumentSchema>;
