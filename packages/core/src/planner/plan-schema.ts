import { z } from 'zod';
import type { Channel, ItemFormat } from './channel-formats';
import { channelSchema, itemFormatSchema } from './channel-formats';

export const plannedSlotsSchema = z.object({
  slots: z.array(
    z.object({
      channel: channelSchema,
      format: itemFormatSchema,
      pillar: z.string(),
      angle: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }),
  ),
});

export type PlannedSlot = {
  channel: Channel;
  format: ItemFormat;
  pillar: string;
  angle: string;
  scheduledAt: Date;
};
