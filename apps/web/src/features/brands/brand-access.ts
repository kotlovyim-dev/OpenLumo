import { notFound } from 'next/navigation';
import { z } from 'zod';
import { BrandAccessDeniedError, requireBrandAccess, type BrandMembership, type MemberRole } from '@openlumo/core';
import type { Database } from '@openlumo/db';

export async function findBrandAccess(
  db: Database,
  userId: string,
  brandId: string,
  minimumRole: MemberRole,
): Promise<BrandMembership | null> {
  if (!z.uuid().safeParse(brandId).success) return null;
  try {
    return await requireBrandAccess(db, userId, brandId, minimumRole);
  } catch (error) {
    if (error instanceof BrandAccessDeniedError) return null;
    throw error;
  }
}

export async function requireBrandAccessOrNotFound(
  db: Database,
  userId: string,
  brandId: string,
  minimumRole: MemberRole,
): Promise<BrandMembership> {
  const membership = await findBrandAccess(db, userId, brandId, minimumRole);
  if (!membership) notFound();
  return membership;
}
