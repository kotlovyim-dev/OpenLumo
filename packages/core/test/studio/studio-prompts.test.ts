import { describe, expect, it } from 'vitest';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { channelFormats, type Channel, type ItemFormat } from '../../src/planner/channel-formats';
import { untrustedContentRule } from '../../src/prompts/untrusted-content';
import { adRules } from '../../src/studio/ad-guidance';
import { channelGuidance } from '../../src/studio/channel-guidance';
import { imageBriefRules } from '../../src/studio/image-brief-rules';
import { buildCopyMessages } from '../../src/studio/studio-prompts';

const dna = createPartialBrandDna({ name: 'Acme', palette: ['#d97706'] });
const channelFormatPairs = (Object.entries(channelFormats) as [Channel, ItemFormat[]][]).flatMap(([channel, formats]) =>
  formats.map((format) => [channel, format] as const),
);
const adChannels = channelFormatPairs.filter(([, format]) => format === 'static_ad').map(([channel]) => channel);

function systemFor(channel: Channel, format: ItemFormat): string {
  const messages = buildCopyMessages({
    dna,
    feedback: [],
    item: { channel, format, pillar: 'Craft', angle: 'Dawn bake' },
    language: 'de',
  });
  return messages[0]!.content;
}

describe('buildCopyMessages', () => {
  it('keeps the language rule and applies the shared writing rules to every format', () => {
    for (const [channel, format] of channelFormatPairs) {
      const system = systemFor(channel, format);
      expect(system).toContain('Write in the language with BCP 47 code "de". Follow the brand voice.');
      expect(system).toContain(untrustedContentRule);
      expect(system).toContain('The pillar and the angle give the direction, never facts');
      expect(system).toContain('Never invent numbers');
      expect(system).toContain('delve');
      expect(system).toContain('"comment YES"');
      expect(system).toContain('sentence case');
    }
  });

  it('gives organic formats the organic channel rules and static ads only the ad rules', () => {
    for (const [channel, format] of channelFormatPairs) {
      const system = systemFor(channel, format);
      if (format === 'static_ad') {
        expect(system).toContain(adRules(channel));
        expect(system).not.toContain(channelGuidance[channel]);
      } else {
        expect(system).toContain(channelGuidance[channel]);
      }
    }
  });

  it.each(adChannels)('never points a %s static ad to a bio, a comment or a reply', (channel) => {
    const system = systemFor(channel, 'static_ad');
    expect(system).not.toMatch(/\bbio\b|first comment|first reply/i);
    expect(system).toContain('labels the link button');
    expect(system).toMatch(/Headline up to \d+ characters/);
  });

  it.each<[Channel, ItemFormat, string[]]>([
    ['instagram', 'social_post', ['first line is the hook', 'never more than 5', '3 to 5 specific topical tags', 'link in bio']],
    ['linkedin', 'social_post', ['800 to 1,300 characters', '0 to 3', 'link in the first comment']],
    ['x', 'social_post', ['under 200 characters', '0 or 1']],
    ['tiktok', 'social_post', ['keyword', '3 to 5']],
    ['linkedin', 'carousel', ['6 to 8 slides', 'Slide 1', 'Last slide', 'never repeats the slides']],
    ['facebook', 'static_ad', ['problem-agitate-solution', 'never the brand name', 'up to 27 characters', 'No hashtags']],
    ['x', 'static_ad', ['Headline up to 50 characters']],
    ['tiktok', 'static_ad', ['Ad text up to 100 characters']],
    ['email', 'email', ['30 to 50 characters', '40 to 90 characters', 'first 150 characters', 'one primary call to action']],
    ['blog', 'blog_post', ['at most 60 characters', 'first 40 to 60 words', 'Key takeaways', 'FAQ', '[ADD:']],
  ])('gives %s %s its channel and format rules', (channel, format, rules) => {
    const system = systemFor(channel, format);
    for (const rule of rules) expect(system).toContain(rule);
  });

  it('adds image brief rules with the placement aspect ratio only to formats with images', () => {
    const instagram = systemFor('instagram', 'carousel');
    expect(instagram).toContain('one focal subject');
    expect(instagram).toContain('4:5 frame');
    expect(instagram).toContain('Never ask for text, letters, logos or watermarks');
    expect(instagram).toContain('same style line');
    expect(systemFor('tiktok', 'static_ad')).toContain('9:16 frame');
    expect(systemFor('email', 'email')).not.toContain('Image brief rules');
    expect(systemFor('blog', 'blog_post')).not.toContain('Image brief rules');
  });
});

describe('imageBriefRules', () => {
  const rules = imageBriefRules('4:5');

  it('keeps platforms, post types and text space out of the scene', () => {
    expect(rules).not.toMatch(/instagram|facebook|linkedin|tiktok|feed post|white text/i);
    expect(rules).toContain('Never name a platform, an app, a screen or a post type');
    expect(rules).toContain('an uncluttered, darker lower third');
  });

  it('asks for colours in words and a short avoid line', () => {
    expect(rules).toContain('never as hex codes');
    expect(rules).toContain('"Avoid:" line: stock-photo look, plastic skin, posed groups, clutter.');
  });
});
