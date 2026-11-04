import { describe, expect, it } from 'vitest';
import type { TextRequest } from '@openlumo/providers';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { fakeResponses } from '../../src/models/fake-responses';
import { buildPlanMessages, buildStrategyMessages } from '../../src/planner/planner-prompts';
import { strategyDocumentSchema } from '../../src/planner/strategy-schema';

const dna = createPartialBrandDna({ name: 'Acme', palette: [] });
const strategy = strategyDocumentSchema.parse(fakeResponses.strategy!({ messages: [] } as unknown as TextRequest));

function text(messages: { content: string }[]): string {
  return messages.map((message) => message.content).join('\n');
}

describe('buildStrategyMessages', () => {
  const prompt = text(buildStrategyMessages(dna, 'launch', ['instagram', 'email']));

  it('asks for problem-based pillars with named series and the content mix', () => {
    expect(prompt).toContain('3 to 5 pillars');
    expect(prompt).toContain('never after company departments');
    expect(prompt).toContain('recurring series');
    expect(prompt).toContain('70% value');
    expect(prompt).toContain('at most 10% direct promotion');
  });

  it('asks for three to five concrete campaign ideas led by a hero idea', () => {
    expect(prompt).toContain('three to five campaign ideas');
    expect(prompt).toContain('hero idea');
    expect(prompt).toContain('no competitor could run it unchanged');
  });

  it('gives the default cadence of the requested channels only', () => {
    expect(prompt).toContain('instagram: 3 to 5 posts a week');
    expect(prompt).toContain('email: 1 a week');
    expect(prompt).not.toContain('linkedin:');
  });
});

describe('buildPlanMessages', () => {
  const prompt = text(
    buildPlanMessages({ dna, strategy, from: new Date('2026-11-05T09:00:00Z'), days: 30, existing: [] }),
  );

  it('keeps the mix and never puts two promotional items in a row', () => {
    expect(prompt).toContain('at most 10% promotion');
    expect(prompt).toContain('never put two promotional items in a row');
  });

  it('asks for series, a repurposed hero idea and platform-native, brand-specific angles', () => {
    expect(prompt).toContain('named series');
    expect(prompt).toContain('hero idea repurposed across at least three channels');
    expect(prompt).toContain('different angle on each channel');
    expect(prompt).toContain('no competitor could post it unchanged');
    expect(prompt).toContain('Never write a generic topic');
  });
});
