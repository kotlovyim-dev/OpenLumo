'use server';

import { notFound } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './export-service';

export async function exportItems(brandId: string, itemIds: string[]) {
  const { db, boss, user } = await getServerContext();
  const result = await service.exportItems({ db, boss, user }, brandId, itemIds);
  if (!result.ok && result.error === 'not_found') notFound();
  return result;
}

export async function getExportRun(brandId: string, runId: string) {
  const { db, boss, user } = await getServerContext();
  const result = await service.getExportRun({ db, boss, user }, brandId, runId);
  if (!result.ok) notFound();
  return result;
}
