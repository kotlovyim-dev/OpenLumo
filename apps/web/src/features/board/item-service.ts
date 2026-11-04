import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  addDnaFeedback,
  appendVersion,
  attachAssets,
  formatCopySchemas,
  getVersion,
  InvalidTransitionError,
  ItemNotFoundError,
  requestRegeneration,
  transitionItem,
  type ContentItem,
  type FormatCopy,
  type Queue,
} from '@openlumo/core';
import { contentItems, itemVersions, type Database, type Transaction } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import { toFieldErrors, type FieldErrors } from '../../lib/field-errors';

export type ItemContext = { db: Database; boss: Queue; user: { id: string } };

export type ItemResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'invalid_transition' | 'invalid_input' | 'conflict'; fieldErrors?: FieldErrors };

const notFound = { ok: false, error: 'not_found' } as const;
const ok = { ok: true } as const;

const reasonSchema = z.string().trim().min(1).max(500);
const regenerationSchema = z.object({
  scope: z.enum(['copy', 'image', 'all']),
  feedback: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});
const scheduledAtSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const reschedulable = new Set<ContentItem['status']>(['suggested', 'in_review', 'scheduled']);

async function findEditableItem(context: ItemContext, itemId: string) {
  if (!z.uuid().safeParse(itemId).success) return null;
  const [item] = await context.db
    .select({ brandId: contentItems.brandId, format: contentItems.format })
    .from(contentItems)
    .where(eq(contentItems.id, itemId));
  if (!item || !(await findBrandAccess(context.db, context.user.id, item.brandId, 'editor'))) return null;
  return item;
}

async function changeItem(
  context: ItemContext,
  itemId: string,
  change: (tx: Transaction, item: ContentItem) => Promise<ItemResult>,
): Promise<ItemResult> {
  try {
    return await context.db.transaction(async (tx) => {
      const [item] = await tx.select().from(contentItems).where(eq(contentItems.id, itemId)).for('update');
      return item ? change(tx, item) : notFound;
    });
  } catch (error) {
    if (error instanceof InvalidTransitionError) return { ok: false, error: 'invalid_transition' };
    throw error;
  }
}

async function setStatus(tx: Transaction, item: ContentItem, status: ContentItem['status']) {
  if (status !== item.status) await tx.update(contentItems).set({ status }).where(eq(contentItems.id, item.id));
}

async function appendUserVersion(tx: Transaction, item: ContentItem, copy: FormatCopy, assetIds?: string[]) {
  const status = transitionItem(item.status, 'edit', item.scheduledAt !== null);
  const [current] = item.currentVersionId
    ? await tx
        .select({ number: itemVersions.number, assetIds: itemVersions.assetIds })
        .from(itemVersions)
        .where(eq(itemVersions.id, item.currentVersionId))
    : [];
  const version = await appendVersion(tx, item.id, (current?.number ?? 0) + 1, { copy, author: 'user' });
  if (!version) return { ok: false, error: 'conflict' } as const;
  const keptAssetIds = assetIds ?? current?.assetIds ?? [];
  if (keptAssetIds.length > 0) await attachAssets(tx, version.id, keptAssetIds);
  await setStatus(tx, item, status);
  return ok;
}

export async function approveItem(context: ItemContext, itemId: string): Promise<ItemResult> {
  if (!(await findEditableItem(context, itemId))) return notFound;
  return changeItem(context, itemId, async (tx, item) => {
    await setStatus(tx, item, transitionItem(item.status, 'approve', item.scheduledAt !== null));
    return ok;
  });
}

export async function rejectItem(context: ItemContext, itemId: string, reason: string): Promise<ItemResult> {
  if (!(await findEditableItem(context, itemId))) return notFound;
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input', fieldErrors: { reason: 'Give a reason up to 500 characters.' } };
  }
  return changeItem(context, itemId, async (tx, item) => {
    await setStatus(tx, item, transitionItem(item.status, 'reject', item.scheduledAt !== null));
    await addDnaFeedback(tx, item.brandId, parsed.data, item.id);
    return ok;
  });
}

export async function editItemCopy(context: ItemContext, itemId: string, copy: unknown): Promise<ItemResult> {
  const found = await findEditableItem(context, itemId);
  if (!found) return notFound;
  const parsed = formatCopySchemas[found.format].safeParse(copy);
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: toFieldErrors(parsed.error) };
  return changeItem(context, itemId, (tx, item) => appendUserVersion(tx, item, parsed.data));
}

export async function restoreVersion(context: ItemContext, itemId: string, versionNumber: number): Promise<ItemResult> {
  if (!(await findEditableItem(context, itemId))) return notFound;
  if (!z.int().positive().safeParse(versionNumber).success) return notFound;
  return changeItem(context, itemId, async (tx, item) => {
    const source = await getVersion(tx, item.id, versionNumber);
    return source ? appendUserVersion(tx, item, source.copy as FormatCopy, source.assetIds) : notFound;
  });
}

export async function regenerateItem(
  context: ItemContext,
  itemId: string,
  scope: unknown,
  feedback?: unknown,
): Promise<ItemResult> {
  if (!(await findEditableItem(context, itemId))) return notFound;
  const parsed = regenerationSchema.safeParse({ scope, feedback });
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: toFieldErrors(parsed.error) };
  try {
    await requestRegeneration(context.db, context.boss, { itemId, ...parsed.data, userId: context.user.id });
    return ok;
  } catch (error) {
    if (error instanceof InvalidTransitionError) return { ok: false, error: 'invalid_transition' };
    if (error instanceof ItemNotFoundError) return notFound;
    throw error;
  }
}

export async function scheduleItem(context: ItemContext, itemId: string, scheduledAt: string): Promise<ItemResult> {
  if (!(await findEditableItem(context, itemId))) return notFound;
  const parsed = scheduledAtSchema.safeParse(scheduledAt);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input', fieldErrors: { scheduledAt: 'Pick a valid date and time.' } };
  }
  return changeItem(context, itemId, async (tx, item) => {
    if (item.status !== 'approved' && !reschedulable.has(item.status)) return { ok: false, error: 'invalid_transition' };
    const status = item.status === 'approved' ? transitionItem(item.status, 'schedule', true) : item.status;
    await tx.update(contentItems).set({ status, scheduledAt: parsed.data }).where(eq(contentItems.id, item.id));
    return ok;
  });
}
