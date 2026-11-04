import { describe, expect, it } from 'vitest';
import { aspectRatioFor } from '../../src/studio/aspect-ratio';

describe('aspectRatioFor', () => {
  it.each([
    ['instagram', '4:5'],
    ['tiktok', '9:16'],
    ['blog', '16:9'],
    ['email', '16:9'],
    ['facebook', '1:1'],
    ['linkedin', '1:1'],
    ['x', '1:1'],
  ] as const)('maps %s to %s', (channel, expected) => {
    expect(aspectRatioFor(channel)).toBe(expected);
  });
});
