import type { AspectRatio } from '@openlumo/providers';
import type { Channel, ItemFormat } from '../planner/channel-formats';

const channelRatios: Partial<Record<Channel, AspectRatio>> = {
  instagram: '4:5',
  tiktok: '9:16',
  blog: '16:9',
  email: '16:9',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function aspectRatioFor(channel: Channel, _format: ItemFormat): AspectRatio {
  return channelRatios[channel] ?? '1:1';
}
