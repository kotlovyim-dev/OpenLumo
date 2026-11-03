import { describe, expect, it } from 'vitest';
import { FakeProvider, type TextRequest } from '@openlumo/providers';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { fakeResponses } from '../../src/models/fake-responses';
import { channelFormats, type ItemFormat } from '../../src/planner/channel-formats';
import { formatCopySchemas } from '../../src/studio/format-schemas';
import { copyLanguage, generateCopy } from '../../src/studio/generate-copy';

const dna = createPartialBrandDna({ name: 'Acme', palette: [] });
const formats = Object.keys(formatCopySchemas) as ItemFormat[];
const request = { messages: [] } as unknown as TextRequest;

describe('formatCopySchemas', () => {
  it.each(formats)('accepts the %s fixture', (format) => {
    expect(formatCopySchemas[format].safeParse(fakeResponses[`copy_${format}`]!(request)).success).toBe(true);
  });

  it('rejects a carousel with one slide or six slides', () => {
    const carousel = fakeResponses.copy_carousel!(request) as { slides: unknown[] };
    const slide = carousel.slides[0];
    expect(formatCopySchemas.carousel.safeParse({ ...carousel, slides: [slide] }).success).toBe(false);
    expect(formatCopySchemas.carousel.safeParse({ ...carousel, slides: Array(6).fill(slide) }).success).toBe(false);
  });

  it('has a schema for every format a channel can plan', () => {
    const planned = new Set(Object.values(channelFormats).flat());
    expect([...planned].every((format) => formats.includes(format))).toBe(true);
  });
});

describe('generateCopy', () => {
  function capture() {
    const requests: TextRequest[] = [];
    const brain = new FakeProvider({
      respond: (incoming) => {
        requests.push(incoming);
        return JSON.stringify(fakeResponses[incoming.jsonSchema!.name]!(incoming));
      },
    });
    return { brain, requests };
  }

  it('uses the copy schema of the item format and puts dna, feedback, language and instruction in the prompt', async () => {
    const { brain, requests } = capture();
    const { copy } = await generateCopy(brain, 'fake', {
      dna,
      feedback: ['less corporate'],
      item: { channel: 'instagram', format: 'social_post', pillar: 'Behind the scenes', angle: 'Dawn bake' },
      instruction: 'mention the new loaf',
      language: 'de',
    });

    expect(requests[0]!.jsonSchema!.name).toBe('copy_social_post');
    const prompt = requests[0]!.messages.map((message) => message.content).join('\n');
    expect(prompt).toContain('- less corporate');
    expect(prompt).toContain('Instruction: mention the new loaf');
    expect(prompt).toContain('"de"');
    expect(prompt).toContain('Dawn bake');
    expect(prompt).toContain('"name":"Acme"');
    expect(copy).toMatchObject({ imageBrief: { prompt: expect.stringContaining('mention the new loaf') } });
  });

  it('omits the feedback and instruction sections when there are none', async () => {
    const { brain, requests } = capture();
    await generateCopy(brain, 'fake', {
      dna,
      feedback: [],
      item: { channel: 'email', format: 'email', pillar: 'p', angle: 'a' },
      language: 'en',
    });
    const prompt = requests[0]!.messages.map((message) => message.content).join('\n');
    expect(prompt).not.toContain('Feedback');
    expect(prompt).not.toContain('Instruction:');
  });
});

describe('copyLanguage', () => {
  it('takes the first dna language and defaults to en', () => {
    expect(copyLanguage({ ...dna, languages: ['fr', 'en'] })).toBe('fr');
    expect(copyLanguage({ ...dna, languages: [] })).toBe('en');
  });
});
