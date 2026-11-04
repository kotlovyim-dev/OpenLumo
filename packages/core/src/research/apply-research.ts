import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { ResearchFindings } from './research-schema';

function preferFound<T>(found: T[], current: T[]): T[] {
  return found.length > 0 ? found : current;
}

export function applyResearch(dna: BrandDna, findings: ResearchFindings): BrandDna {
  const { audience } = dna;
  return {
    ...dna,
    identity: {
      ...dna.identity,
      name: dna.identity.name.trim() || findings.name.trim(),
      features: preferFound(findings.features, dna.identity.features),
    },
    audience: {
      segments: preferFound(findings.audience.segments, audience.segments),
      painPoints: preferFound(findings.audience.painPoints, audience.painPoints),
      buyingTriggers: preferFound(findings.audience.buyingTriggers, audience.buyingTriggers),
      objections: preferFound(findings.audience.objections, audience.objections),
      channels: preferFound(findings.audience.channels, audience.channels),
    },
    competitors: preferFound(findings.competitors, dna.competitors),
  };
}
