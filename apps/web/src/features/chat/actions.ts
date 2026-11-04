'use server';

import { notFound } from 'next/navigation';
import { getServerContext } from '@/lib/server-context';
import * as service from './chat-service';

export async function sendChatMessage(brandId: string, content: string) {
  const { db, boss, user } = await getServerContext();
  const result = await service.sendChatMessage({ db, boss, user }, brandId, content);
  if (!result.ok && result.error === 'not_found') notFound();
  return result;
}

export async function retryChatReply(brandId: string, messageId: string) {
  const { db, boss, user } = await getServerContext();
  const result = await service.retryChatReply({ db, boss, user }, brandId, messageId);
  if (!result.ok) notFound();
  return result;
}

export async function listChatMessages(brandId: string) {
  const { db, boss, user } = await getServerContext();
  const result = await service.listChatMessages({ db, boss, user }, brandId);
  if (!result.ok) notFound();
  return result;
}
