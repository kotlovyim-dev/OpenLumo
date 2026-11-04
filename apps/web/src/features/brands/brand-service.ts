import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { addBrandMember, createBrand, enqueue, setBrandStatus, type Queue } from '@openlumo/core';
import { users, type Database } from '@openlumo/db';
import { findBrandAccess } from './brand-access';

export type BrandContext = { db: Database; boss: Queue; user: { id: string } };

export type CreateBrandResult =
  | { ok: true; brandId: string }
  | { ok: false; error: 'invalid_input'; fieldErrors: { name?: string; url?: string } };

export type InviteResult = { ok: true } | { ok: false; error: 'invalid_input' | 'user_not_found' | 'forbidden' | 'already_member' };

function isWebAddress(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const createBrandSchema = z.object({
  name: z.string().trim().max(200),
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === '' || isWebAddress(value)),
});

const inviteSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  role: z.enum(['editor', 'viewer']),
});

export async function createBrandForUser(context: BrandContext, formData: FormData): Promise<CreateBrandResult> {
  const parsed = createBrandSchema.safeParse({
    name: formData.get('name') ?? '',
    url: formData.get('url') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: { name?: string; url?: string } = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'name') fieldErrors.name = 'Use 200 characters or fewer.';
      if (issue.path[0] === 'url') fieldErrors.url = 'Enter a full http or https address, up to 2048 characters.';
    }
    return { ok: false, error: 'invalid_input', fieldErrors };
  }
  const { name, url } = parsed.data;
  const brand = await createBrand(context.db, {
    name: name || undefined,
    url: url || undefined,
    createdBy: context.user.id,
  });
  if (url) {
    try {
      await enqueue(
        context.boss,
        context.db,
        'brand.crawl',
        { brandId: brand.id },
        { idempotencyKey: `crawl:${brand.id}` },
      );
    } catch (error) {
      console.error(`Could not enqueue crawl for brand ${brand.id}`, error);
      await setBrandStatus(context.db, brand.id, 'needs_input');
    }
  }
  return { ok: true, brandId: brand.id };
}

export async function inviteMember(
  context: Pick<BrandContext, 'db' | 'user'>,
  brandId: string,
  email: string,
  role: string,
): Promise<InviteResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'owner'))) {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = inviteSchema.safeParse({ email, role });
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const [invitee] = await context.db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
  if (!invitee) return { ok: false, error: 'user_not_found' };
  const added = await addBrandMember(context.db, brandId, invitee.id, parsed.data.role);
  return added ? { ok: true } : { ok: false, error: 'already_member' };
}
