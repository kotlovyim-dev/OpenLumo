'use server';

import { notFound } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './strategy-service';

async function run(call: (context: service.StrategyContext) => Promise<service.StrategyResult>) {
  const { db, boss, user } = await getServerContext();
  const result = await call({ db, boss, user });
  if (!result.ok && result.error === 'forbidden') notFound();
  return result;
}

export async function createStrategyAction(brandId: string, goal: string, channels: string[]) {
  return run((context) => service.createStrategyForBrand(context, brandId, goal, channels));
}

export async function planMoreAction(brandId: string) {
  return run((context) => service.planMore(context, brandId));
}
