import { describe, expect, it } from 'vitest';
import { describeItemForCritique } from '../../src/chat/critique-item';
import { buildRepurposeInstruction } from '../../src/chat/repurpose-item';
import { channelGuidance } from '../../src/studio/channel-guidance';
import { formatGuidance } from '../../src/studio/format-guidance';
import type { CarouselCopy, SocialPostCopy } from '../../src/studio/format-schemas';

const post: SocialPostCopy = {
  caption: 'Our sourdough rests for 36 hours before it meets the oven.',
  hashtags: ['#sourdough'],
  imageBrief: { prompt: 'A loaf on a board' },
};

describe('describeItemForCritique', () => {
  const text = describeItemForCritique(
    { id: 'item-1', channel: 'linkedin', format: 'social_post', status: 'in_review' },
    post,
  );

  it('states the channel, format and status and wraps the current copy as untrusted JSON', () => {
    expect(text).toContain('Item item-1 is a social_post for linkedin with status in_review.');
    expect(text).toContain(`<untrusted_content label="item_copy">\n${JSON.stringify(post)}\n</untrusted_content>`);
  });

  it('adds the checklist for the channel and the format', () => {
    expect(text).toContain(channelGuidance.linkedin);
    expect(text).toContain(formatGuidance.social_post);
    expect(text).toContain('Image brief rules');
    expect(text).not.toContain(channelGuidance.instagram);
  });

  it('lists the banned words and phrases found in the copy', () => {
    expect(text).toContain('Banned words and phrases found: none.');
    const slop = { ...post, caption: "Let's dive in: we leverage a seamless bake." };
    const flagged = describeItemForCritique({ id: 'item-2', channel: 'x', format: 'social_post', status: 'suggested' }, slop);
    expect(flagged).toContain('Banned words and phrases found: "seamless", "leverage", "Let\'s dive in".');
  });
});

describe('buildRepurposeInstruction', () => {
  it('asks for a native rewrite of the wrapped source text with the angle', () => {
    const instruction = buildRepurposeInstruction(
      { channel: 'instagram', format: 'social_post', copy: post },
      { channel: 'linkedin', format: 'carousel', angle: 'The 36-hour rest, step by step' },
    );
    expect(instruction).toContain('native carousel for linkedin');
    expect(instruction).toContain('never copy its sentences word for word');
    expect(instruction).toContain('Angle: The 36-hour rest, step by step');
    expect(instruction).toContain('<untrusted_content label="source_item">\nOur sourdough rests for 36 hours');
  });

  it('caps the source text at 1500 characters and omits a missing angle', () => {
    const slide = { title: 'Step', text: 'x'.repeat(400), imageBrief: { prompt: 'p' } };
    const carousel: CarouselCopy = { slides: Array(8).fill(slide), caption: 'Caption' };
    const instruction = buildRepurposeInstruction(
      { channel: 'linkedin', format: 'carousel', copy: carousel },
      { channel: 'x', format: 'social_post' },
    );
    expect(instruction).not.toContain('Angle:');
    const source = /<untrusted_content label="source_item">\n([\s\S]*)\n<\/untrusted_content>/.exec(instruction)![1]!;
    expect(source.startsWith('Slide 1: Step')).toBe(true);
    expect(source).toHaveLength(1500);
  });
});
