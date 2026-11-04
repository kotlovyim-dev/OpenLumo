import type { AspectRatio } from '@openlumo/providers';
import type { Channel } from '../planner/channel-formats';

const channelRatios: Partial<Record<Channel, AspectRatio>> = {
  instagram: '4:5',
  tiktok: '9:16',
  blog: '16:9',
  email: '16:9',
};

export function aspectRatioFor(channel: Channel): AspectRatio {
  return channelRatios[channel] ?? '1:1';
}
