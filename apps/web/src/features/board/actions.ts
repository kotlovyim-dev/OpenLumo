'use server';

import { notFound } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './item-service';

async function run(call: (context: service.ItemContext) => Promise<service.ItemResult>) {
  const { db, boss, user } = await getServerContext();
  const result = await call({ db, boss, user });
  if (!result.ok && result.error === 'not_found') notFound();
  return result;
}

export async function approveItem(itemId: string) {
  return run((context) => service.approveItem(context, itemId));
}

export async function rejectItem(itemId: string, reason: string) {
  return run((context) => service.rejectItem(context, itemId, reason));
}

export async function editItemCopy(itemId: string, copy: unknown) {
  return run((context) => service.editItemCopy(context, itemId, copy));
}

export async function regenerateItem(itemId: string, scope: 'copy' | 'image' | 'all', feedback?: string) {
  return run((context) => service.regenerateItem(context, itemId, scope, feedback));
}

export async function scheduleItem(itemId: string, scheduledAt: string) {
  return run((context) => service.scheduleItem(context, itemId, scheduledAt));
}

export async function restoreVersion(itemId: string, versionNumber: number) {
  return run((context) => service.restoreVersion(context, itemId, versionNumber));
}
