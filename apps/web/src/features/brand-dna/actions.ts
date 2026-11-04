'use server';

import { notFound } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './dna-service';

async function run(call: (context: service.DnaContext) => Promise<service.DnaResult>) {
  const { db, boss, user } = await getServerContext();
  const result = await call({ db, boss, user });
  if (!result.ok && (result.error === 'forbidden' || result.error === 'not_found')) notFound();
  return result;
}

export async function updateBrandDna(brandId: string, dna: unknown) {
  return run((context) => service.updateBrandDna(context, brandId, dna));
}

export async function addFeedbackAction(brandId: string, note: string) {
  return run((context) => service.addFeedback(context, brandId, note));
}

export async function mergeFeedbackAction(brandId: string) {
  return run((context) => service.requestFeedbackMerge(context, brandId));
}
