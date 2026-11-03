import { z } from 'zod';
import { channel, itemFormat } from '@openlumo/db';

export const channelSchema = z.enum(channel.enumValues);
export const itemFormatSchema = z.enum(itemFormat.enumValues);

export type Channel = z.infer<typeof channelSchema>;
export type ItemFormat = z.infer<typeof itemFormatSchema>;

export const channelFormats: Record<Channel, ItemFormat[]> = {
  email: ['email'],
  blog: ['blog_post'],
  instagram: ['social_post', 'carousel', 'static_ad'],
  facebook: ['social_post', 'carousel', 'static_ad'],
  linkedin: ['social_post', 'carousel', 'static_ad'],
  x: ['social_post', 'static_ad'],
  tiktok: ['social_post', 'static_ad'],
};
