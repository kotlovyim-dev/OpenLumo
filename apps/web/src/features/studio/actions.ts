'use server';

import { notFound } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './studio-service';

export async function generateOnDemand(brandId: string, input: unknown) {
  const { db, boss, user } = await getServerContext();
  const result = await service.generateOnDemand({ db, boss, user }, brandId, input);
  if (!result.ok && result.error === 'not_found') notFound();
  return result;
}
