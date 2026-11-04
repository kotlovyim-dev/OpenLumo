'use server';

import { redirect } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './brand-service';

export async function createBrandAction(formData: FormData) {
  const { db, boss, user } = await getServerContext();
  const result = await service.createBrandForUser({ db, boss, user }, formData);
  if (!result.ok) return result;
  redirect(`/brands/${result.brandId}/onboarding`);
}

export async function inviteMemberAction(brandId: string, formData: FormData) {
  const { db, user } = await getServerContext();
  return service.inviteMember(
    { db, user },
    brandId,
    String(formData.get('email') ?? ''),
    String(formData.get('role') ?? ''),
  );
}
