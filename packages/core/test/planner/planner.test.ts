import { describe, expect, it } from 'vitest';
import { FakeProvider, type TextRequest } from '@openlumo/providers';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { fakeResponses } from '../../src/models/fake-responses';
import { channelFormats } from '../../src/planner/channel-formats';
import { planContent } from '../../src/planner/plan-content';
import { strategyDocumentSchema } from '../../src/planner/strategy-schema';

const dna = createPartialBrandDna({ name: 'Acme', palette: [] });
const strategy = strategyDocumentSchema.parse(fakeResponses.strategy!({ messages: [] } as unknown as TextRequest));
const from = new Date('2026-11-05T09:00:00Z');

function planFrom(slots: unknown[], days = 30) {
  const brain = new FakeProvider({ respond: () => JSON.stringify({ slots }) });
  return planContent(brain, 'fake', { dna, strategy, from, days, existing: [] });
}

const slot = { channel: 'instagram', format: 'social_post', pillar: 'p', angle: 'a', date: '2026-11-10' };

describe('strategyDocumentSchema', () => {
  it('accepts the fake fixture and rejects 2 campaign ideas', () => {
    expect(strategy.campaignIdeas).toHaveLength(3);
    const twoIdeas = { ...strategy, campaignIdeas: strategy.campaignIdeas.slice(0, 2) };
    expect(strategyDocumentSchema.safeParse(twoIdeas).success).toBe(false);
  });
});

describe('channelFormats', () => {
  it('maps channels to their allowed formats', () => {
    expect(channelFormats.email).toEqual(['email']);
    expect(channelFormats.blog).toEqual(['blog_post']);
    expect(channelFormats.x).toEqual(['social_post', 'static_ad']);
    expect(channelFormats.linkedin).toEqual(['social_post', 'carousel', 'static_ad']);
  });
});

describe('planContent', () => {
  it('keeps valid slots at 09:00 UTC unless a time is given', async () => {
    const { slots } = await planFrom([slot, { ...slot, date: '2026-11-12', time: '16:30' }]);
    expect(slots.map((planned) => planned.scheduledAt.toISOString())).toEqual([
      '2026-11-10T09:00:00.000Z',
      '2026-11-12T16:30:00.000Z',
    ]);
  });

  it('drops a tiktok carousel slot', async () => {
    const { slots } = await planFrom([{ ...slot, channel: 'tiktok', format: 'carousel' }, slot]);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.channel).toBe('instagram');
  });

  it('drops a slot dated 31 days out and one before the window', async () => {
    const { slots } = await planFrom([
      { ...slot, date: '2026-12-06' },
      { ...slot, date: '2026-11-04' },
      { ...slot, date: '2026-12-04' },
    ]);
    expect(slots.map((planned) => planned.scheduledAt.toISOString())).toEqual(['2026-12-04T09:00:00.000Z']);
  });

  it('keeps every slot of the fake content plan inside the requested window', async () => {
    const brain = new FakeProvider({
      respond: (request) => JSON.stringify(fakeResponses[request.jsonSchema!.name]!(request)),
    });
    const raw = fakeResponses.content_plan!({
      messages: [{ role: 'user', content: 'Window: 2026-11-05T09:00:00.000Z to 2026-12-05T09:00:00.000Z\nChannels: instagram, email' }],
    } as unknown as TextRequest) as { slots: unknown[] };
    const { slots } = await planContent(brain, 'fake', { dna, strategy, from, days: 30, existing: [] });
    expect(raw.slots.length).toBeGreaterThan(5);
    expect(slots).toHaveLength(raw.slots.length);
  });
});
