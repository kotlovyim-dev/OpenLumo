import type { Channel } from '@openlumo/core';

export const channelLabels: Record<Channel, string> = {
  email: 'Email',
  blog: 'Blog',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
};

export const channelDotClasses: Record<Channel, string> = {
  email: 'bg-channel-email',
  blog: 'bg-channel-seo',
  instagram: 'bg-channel-socials',
  facebook: 'bg-channel-socials',
  linkedin: 'bg-channel-brand',
  x: 'bg-channel-brand',
  tiktok: 'bg-channel-ads',
};
