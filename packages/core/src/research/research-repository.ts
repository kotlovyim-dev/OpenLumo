import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { brandResearch, type Database } from '@openlumo/db';
import {
  type BrandResearch,
  type ResearchFindings,
  type ResearchSource,
  researchFindingsSchema,
  researchSourceSchema,
} from './research-schema';

export async function saveResearch(
  db: Database,
  brandId: string,
  research: { brief: string; sources: ResearchSource[]; findings: ResearchFindings },
): Promise<void> {
  const now = new Date();
  const values = { status: 'succeeded' as const, ...research, researchedAt: now, attemptedAt: now };
  await db
    .insert(brandResearch)
    .values({ brandId, ...values })
    .onConflictDoUpdate({ target: brandResearch.brandId, set: values });
}

export async function recordFailedResearch(db: Database, brandId: string): Promise<void> {
  const values = { status: 'failed' as const, attemptedAt: new Date() };
  await db
    .insert(brandResearch)
    .values({ brandId, ...values })
    .onConflictDoUpdate({ target: brandResearch.brandId, set: values });
}

export async function getResearch(db: Database, brandId: string): Promise<BrandResearch | null> {
  const [row] = await db.select().from(brandResearch).where(eq(brandResearch.brandId, brandId));
  if (!row) return null;
  const findings = researchFindingsSchema.safeParse(row.findings);
  const sources = z.array(researchSourceSchema).safeParse(row.sources);
  return {
    status: row.status,
    brief: row.brief,
    sources: sources.success ? sources.data : [],
    findings: findings.success ? findings.data : null,
    researchedAt: row.researchedAt,
    attemptedAt: row.attemptedAt,
  };
}
