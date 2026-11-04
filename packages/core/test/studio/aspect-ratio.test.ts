import { describe, expect, it } from 'vitest';
import { aspectRatioFor } from '../../src/studio/aspect-ratio';

describe('aspectRatioFor', () => {
  it.each([
    ['instagram', 'social_post', '4:5'],
    ['instagram', 'carousel', '4:5'],
    ['tiktok', 'social_post', '9:16'],
    ['blog', 'blog_post', '16:9'],
    ['email', 'email', '16:9'],
    ['facebook', 'social_post', '1:1'],
    ['linkedin', 'static_ad', '1:1'],
    ['x', 'social_post', '1:1'],
  ] as const)('maps %s %s to %s', (channel, format, expected) => {
    expect(aspectRatioFor(channel, format)).toBe(expected);
  });
});
