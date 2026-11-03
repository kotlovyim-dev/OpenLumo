import { and, desc, eq } from 'drizzle-orm';
import { dnaFeedback, type Database } from '@openlumo/db';

const OPEN_FEEDBACK_LIMIT = 20;

export async function listOpenFeedback(db: Database, brandId: string): Promise<string[]> {
  const rows = await db
    .select({ note: dnaFeedback.note })
    .from(dnaFeedback)
    .where(and(eq(dnaFeedback.brandId, brandId), eq(dnaFeedback.merged, false)))
    .orderBy(desc(dnaFeedback.createdAt))
    .limit(OPEN_FEEDBACK_LIMIT);
  return rows.map((row) => row.note);
}
