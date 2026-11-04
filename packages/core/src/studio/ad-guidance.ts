import type { Channel } from '../planner/channel-formats';

const metaAdRule =
  'Headline up to 27 characters. Primary text of 50 to 150 characters with the hook and the offer in the first 125.';

const defaultAdRule =
  'Headline up to 40 characters. Primary text under 125 characters with the hook and the offer first.';

const adGuidance: Partial<Record<Channel, string>> = {
  instagram: metaAdRule,
  facebook: metaAdRule,
  linkedin: ['Intro text up to 150 characters. Headline up to 50 characters.', 'Emoji: at most 1.'].join('\n'),
  x: 'Headline up to 50 characters. Post text under 200 characters with one concrete claim.',
  tiktok: 'Ad text up to 100 characters, casual and first-person, with the hook first. Headline up to 40 characters.',
};

export function adRules(channel: Channel): string {
  return adGuidance[channel] ?? defaultAdRule;
}
