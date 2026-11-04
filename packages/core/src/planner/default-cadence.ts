import type { Channel } from './channel-formats';

export const defaultCadence: Record<Channel, string> = {
  instagram: '3 to 5 posts a week, mostly carousels',
  facebook: '3 to 5 posts a week',
  linkedin: '2 to 4 posts a week',
  x: '3 to 5 posts a week, one a day at most',
  tiktok: '3 to 5 posts a week',
  email: '1 a week (2 to 4 sends a month)',
  blog: '1 a week (2 to 4 posts a month)',
};
