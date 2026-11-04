import { z } from 'zod';
import { channelFormats, channelSchema, createOnDemandItems, itemFormatSchema, type Queue } from '@openlumo/core';
import type { Database } from '@openlumo/db';
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
  const itemIds = await createOnDemandItems(context.db, context.boss, { brandId, ...parsed.data });
  return { ok: true, itemIds };
}
