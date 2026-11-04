import { and, eq } from 'drizzle-orm';
import { brandMembers, users, type Database } from '@openlumo/db';

export type MemberRole = typeof brandMembers.$inferSelect.role;

export type BrandMembership = { brandId: string; userId: string; role: MemberRole };

const roleRank: Record<MemberRole, number> = { viewer: 0, editor: 1, owner: 2 };

export class BrandAccessDeniedError extends Error {
  readonly retryable = false;
  readonly code = 'brand_access_denied';

  constructor(brandId: string) {
    super(`Access to brand ${brandId} denied`);
    this.name = 'BrandAccessDeniedError';
  }
}

export async function requireBrandAccess(
  db: Database,
  userId: string,
  brandId: string,
  minimumRole: MemberRole,
): Promise<BrandMembership> {
  const [membership] = await db
    .select({ role: brandMembers.role })
    .from(brandMembers)
    .where(and(eq(brandMembers.brandId, brandId), eq(brandMembers.userId, userId)));
  if (membership && roleRank[membership.role] >= roleRank[minimumRole]) {
    return { brandId, userId, role: membership.role };
  }
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (user?.role === 'admin') return { brandId, userId, role: 'owner' };
  throw new BrandAccessDeniedError(brandId);
}
