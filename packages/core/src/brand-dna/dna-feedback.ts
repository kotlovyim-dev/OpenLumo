import { and, desc, eq, inArray } from 'drizzle-orm';
import { generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import { dnaFeedback, type Database, type Transaction } from '@openlumo/db';
import { buildMergeFeedbackMessages } from './brand-dna-prompts';
import { type BrandDna, brandDnaSchema } from './brand-dna-schema';

const OPEN_FEEDBACK_LIMIT = 20;

export async function addDnaFeedback(db: Database | Transaction, brandId: string, note: string, itemId?: string): Promise<string> {
  const [row] = await db.insert(dnaFeedback).values({ brandId, note, itemId }).returning({ id: dnaFeedback.id });
  return row!.id;
}

export async function listOpenFeedbackNotes(
  db: Database,
  brandId: string,
): Promise<{ id: string; note: string }[]> {
  return db
    .select({ id: dnaFeedback.id, note: dnaFeedback.note })
    .from(dnaFeedback)
    .where(and(eq(dnaFeedback.brandId, brandId), eq(dnaFeedback.merged, false)))
    .orderBy(desc(dnaFeedback.createdAt))
    .limit(OPEN_FEEDBACK_LIMIT);
}

export async function listOpenFeedback(db: Database, brandId: string): Promise<string[]> {
  return (await listOpenFeedbackNotes(db, brandId)).map((row) => row.note);
}

export async function markFeedbackMerged(db: Database, brandId: string, noteIds: string[]): Promise<void> {
  if (noteIds.length === 0) return;
  await db
    .update(dnaFeedback)
    .set({ merged: true })
    .where(and(eq(dnaFeedback.brandId, brandId), inArray(dnaFeedback.id, noteIds)));
}

export async function mergeFeedback(
  brain: LanguageModel,
  modelId: string,
  dna: BrandDna,
  notes: string[],
): Promise<{ dna: BrandDna; usage: Usage }> {
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildMergeFeedbackMessages(dna, notes),
    schema: brandDnaSchema,
    schemaName: 'merged_brand_dna',
  });
  return { dna: { ...value, visuals: { ...value.visuals, logoAssetId: dna.visuals.logoAssetId } }, usage };
}
