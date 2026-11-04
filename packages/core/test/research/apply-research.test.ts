import { describe, expect, it } from 'vitest';
import type { TextRequest } from '@openlumo/providers';
import { type BrandDna, createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { fakeResponses } from '../../src/models/fake-responses';
import { applyResearch } from '../../src/research/apply-research';
import type { ResearchFindings } from '../../src/research/research-schema';

const dna = fakeResponses.brand_dna!({} as TextRequest) as BrandDna;

const findings: ResearchFindings = {
  name: 'Sunrise Bakery Ltd',
  features: ['Same-day delivery'],
  audience: {
    segments: ['Remote workers'],
    painPoints: ['No bakery nearby'],
    buyingTriggers: [],
    objections: [],
    channels: ['Reddit r/Breadit'],
  },
  competitors: [
    {
      name: 'Dawn Loaves',
      url: 'https://dawn.example',
      positioning: 'Budget bread',
      strengths: ['Price'],
      weaknesses: [],
      sourceUrls: [],
    },
  ],
};

describe('applyResearch', () => {
  it('replaces features, audience and competitors and keeps voice and visuals', () => {
    const applied = applyResearch(dna, findings);

    expect(applied.identity.features).toEqual(['Same-day delivery']);
    expect(applied.audience.segments).toEqual(['Remote workers']);
    expect(applied.audience.channels).toEqual(['Reddit r/Breadit']);
    expect(applied.competitors).toEqual(findings.competitors);
    expect(applied.voice).toEqual(dna.voice);
    expect(applied.visuals).toEqual(dna.visuals);
    expect(applied.identity.tagline).toBe(dna.identity.tagline);
  });

  it('keeps the existing name and fills an empty one', () => {
    expect(applyResearch(dna, findings).identity.name).toBe('Sunrise Bakery');
    expect(applyResearch(createPartialBrandDna({ name: '', palette: [] }), findings).identity.name).toBe(
      'Sunrise Bakery Ltd',
    );
  });

  it('keeps existing lists the research left empty', () => {
    const applied = applyResearch(dna, { ...findings, features: [], competitors: [] });

    expect(applied.identity.features).toEqual(dna.identity.features);
    expect(applied.audience.buyingTriggers).toEqual(dna.audience.buyingTriggers);
    expect(applied.competitors).toEqual(dna.competitors);
  });
});
