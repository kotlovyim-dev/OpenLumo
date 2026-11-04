import { z } from 'zod';
import { channelFormats, channelSchema, enqueue, itemFormatSchema, type Queue } from '@openlumo/core';
import { contentItems, type Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import { toFieldErrors, type FieldErrors } from '../../lib/field-errors';

export type StudioContext = { db: Database; boss: Queue; user: { id: string } };

export type GenerateResult =
  | { ok: true; itemIds: string[] }
  | { ok: false; error: 'not_found' | 'invalid_input'; fieldErrors?: FieldErrors };

export const MAX_INSTRUCTION_LENGTH = 1000;
export const MAX_VARIANTS = 4;

const generateSchema = z
  .object({
    channel: channelSchema,
    format: itemFormatSchema,
    instruction: z
      .string()
      .trim()
      .max(MAX_INSTRUCTION_LENGTH)
      .optional()
      .transform((value) => value || undefined),
    variants: z.int().min(1).max(MAX_VARIANTS),
  })
  .refine(({ channel, format }) => channelFormats[channel].includes(format), {
    path: ['format'],
    message: 'This channel does not support that format.',
  });

export async function generateOnDemand(
  context: StudioContext,
  brandId: string,
  input: unknown,
): Promise<GenerateResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'not_found' };
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: toFieldErrors(parsed.error) };
  const { channel, format, instruction, variants } = parsed.data;

  const items = await context.db
    .insert(contentItems)
    .values(Array.from({ length: variants }, () => ({ brandId, channel, format, status: 'in_review' as const })))
    .returning({ id: contentItems.id });
  const itemIds = items.map((item) => item.id);
  for (const itemId of itemIds) {
    await enqueue(
      context.boss,
      context.db,
      'item.generate',
      { brandId, itemId, targetVersion: 1, instruction },
      { idempotencyKey: `generate:${itemId}:1` },
    );
  }
  return { ok: true, itemIds };
}
