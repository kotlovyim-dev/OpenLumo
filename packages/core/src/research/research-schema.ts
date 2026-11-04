import { z } from 'zod';
import { brandDnaSchema, competitorSchema } from '../brand-dna/brand-dna-schema';

export const researchFindingsSchema = z.object({
  name: z.string(),
  features: z.array(z.string()),
  audience: brandDnaSchema.shape.audience,
  competitors: z.array(competitorSchema),
});

export type ResearchFindings = z.infer<typeof researchFindingsSchema>;

export const researchSourceSchema = z.object({ url: z.string(), title: z.string() });

export type ResearchSource = z.infer<typeof researchSourceSchema>;

export type BrandResearch = {
  status: 'succeeded' | 'failed';
  brief: string;
  sources: ResearchSource[];
  findings: ResearchFindings | null;
  researchedAt: Date | null;
  attemptedAt: Date;
};
