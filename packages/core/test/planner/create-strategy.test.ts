import { describe, expect, it } from 'vitest';
import { FakeProvider, type TextRequest } from '@openlumo/providers';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { fakeResponses } from '../../src/models/fake-responses';
import { createStrategy, type StrategySection } from '../../src/planner/create-strategy';

const dna = createPartialBrandDna({ name: 'Acme', palette: [] });
const document = fakeResponses.strategy!({ messages: [] } as unknown as TextRequest);

describe('createStrategy', () => {
  it('reports each section once, in order, as the model writes it', async () => {
    const brain = new FakeProvider({ respond: () => JSON.stringify(document) });
    const sections: StrategySection[] = [];
    const { document: created } = await createStrategy(brain, 'fake', { dna, goal: 'awareness', channels: ['instagram'] }, (section) =>
      sections.push(section),
    );
    expect(sections).toEqual(['strengths', 'gaps', 'pillars', 'cadence', 'campaignIdeas']);
    expect(created.campaignIdeas).toHaveLength(3);
  });

  it('never goes back when the model has to retry', async () => {
    const brain = new FakeProvider({ textResponses: ['{"strengths": [], "gaps": [], "pillars": 1}', JSON.stringify(document)] });
    const sections: StrategySection[] = [];
    await createStrategy(brain, 'fake', { dna, goal: 'awareness', channels: ['instagram'] }, (section) => sections.push(section));
    expect(sections).toEqual(['strengths', 'gaps', 'pillars', 'cadence', 'campaignIdeas']);
  });
});
