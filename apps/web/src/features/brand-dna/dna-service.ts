import { z } from 'zod';
import {
  addDnaFeedback,
  brandDnaSchema,
  enqueue,
  findBrand,
  getBrandDna,
  saveBrandDna,
  setBrandStatus,
  type Queue,
} from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import { HEX_COLOR } from './hex-color';

export type DnaContext = { db: Database; boss: Queue; user: { id: string } };

export type FieldErrors = Record<string, string>;

export type DnaResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'not_found' | 'invalid_input'; fieldErrors?: FieldErrors };

const dnaInputSchema = brandDnaSchema.extend({
  visuals: brandDnaSchema.shape.visuals.extend({
    palette: z.array(z.string().regex(HEX_COLOR, 'Use a hex colour like #1a2b3c.')),
  }),
});

const noteSchema = z.string().trim().min(1).max(2000);

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function updateBrandDna(context: DnaContext, brandId: string, dna: unknown): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const parsed = dnaInputSchema.safeParse(dna);
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: toFieldErrors(parsed.error) };
  const brand = await findBrand(context.db, brandId);
  if (!brand) return { ok: false, error: 'not_found' };
  await saveBrandDna(context.db, brandId, parsed.data);
  if (brand.status === 'needs_input') await setBrandStatus(context.db, brandId, 'ready');
  return { ok: true };
}

export async function addFeedback(context: DnaContext, brandId: string, note: string): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: { note: 'Write a note up to 2000 characters.' } };
  await addDnaFeedback(context.db, brandId, parsed.data);
  return { ok: true };
}

export async function requestFeedbackMerge(context: DnaContext, brandId: string): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const saved = await getBrandDna(context.db, brandId);
  if (!saved) return { ok: false, error: 'not_found' };
  await enqueue(
    context.boss,
    context.db,
    'brand.synthesize-dna',
    { brandId, mergeFeedback: true },
    { idempotencyKey: `merge-feedback:${brandId}:${saved.version}` },
  );
  return { ok: true };
}
