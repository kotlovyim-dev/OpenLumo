import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { copyTitle, itemText, type FormatCopy } from '@openlumo/core';
import { contentItems, itemVersions, jobRuns, type Database } from '@openlumo/db';

type Item = typeof contentItems.$inferSelect;
type Run = typeof jobRuns.$inferSelect;

export type ItemStatus = Item['status'];

export type BoardRun = Pick<Run, 'status' | 'step' | 'errorCode' | 'costUsd'>;

export type BoardCard = {
  id: string;
  status: ItemStatus;
  channel: Item['channel'];
  format: Item['format'];
  scheduledAt: string | null;
  title: string | null;
  imageAssetId: string | null;
  run: BoardRun | null;
};

export type ItemVersionEntry = {
  number: number;
  author: 'user' | 'planner' | 'chat';
  createdAt: string;
  copy: unknown;
  assetIds: string[];
};

export type ItemDetail = {
  id: string;
  status: ItemStatus;
  channel: Item['channel'];
  format: Item['format'];
  pillar: string | null;
  angle: string | null;
  scheduledAt: string | null;
  currentVersionNumber: number | null;
  text: string | null;
  versions: ItemVersionEntry[];
};

async function loadCards(db: Database, condition: SQL | undefined): Promise<BoardCard[]> {
  const items = await db
    .select({
      id: contentItems.id,
      status: contentItems.status,
      channel: contentItems.channel,
      format: contentItems.format,
      scheduledAt: contentItems.scheduledAt,
      copy: itemVersions.copy,
      assetIds: itemVersions.assetIds,
    })
    .from(contentItems)
    .leftJoin(itemVersions, eq(itemVersions.id, contentItems.currentVersionId))
    .where(condition)
    .orderBy(sql`${contentItems.scheduledAt} asc nulls last`, asc(contentItems.createdAt));
  if (items.length === 0) return [];

  const runs = await db
    .selectDistinctOn([jobRuns.itemId], {
      itemId: jobRuns.itemId,
      status: jobRuns.status,
      step: jobRuns.step,
      errorCode: jobRuns.errorCode,
      costUsd: jobRuns.costUsd,
    })
    .from(jobRuns)
    .where(
      inArray(
        jobRuns.itemId,
        items.map((item) => item.id),
      ),
    )
    .orderBy(jobRuns.itemId, desc(jobRuns.createdAt));
  const latestRuns = new Map(runs.map(({ itemId, ...run }) => [itemId, run]));

  return items.map((item) => ({
    id: item.id,
    status: item.status,
    channel: item.channel,
    format: item.format,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    title: copyTitle(item.copy),
    imageAssetId: item.assetIds?.[0] ?? null,
    run: latestRuns.get(item.id) ?? null,
  }));
}

export function loadBoard(db: Database, brandId: string): Promise<BoardCard[]> {
  return loadCards(db, and(eq(contentItems.brandId, brandId), ne(contentItems.status, 'rejected')));
}

export function loadOnDemandCards(db: Database, brandId: string): Promise<BoardCard[]> {
  return loadCards(
    db,
    and(eq(contentItems.brandId, brandId), isNull(contentItems.strategyId), ne(contentItems.status, 'rejected')),
  );
}

export function loadCalendarCards(db: Database, brandId: string, from: Date, to: Date): Promise<BoardCard[]> {
  return loadCards(
    db,
    and(
      eq(contentItems.brandId, brandId),
      inArray(contentItems.status, ['suggested', 'in_review', 'approved', 'scheduled']),
      gte(contentItems.scheduledAt, from),
      lt(contentItems.scheduledAt, to),
    ),
  );
}

export async function loadItemDetail(db: Database, brandId: string, itemId: string): Promise<ItemDetail | null> {
  if (!z.uuid().safeParse(itemId).success) return null;
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.brandId, brandId)));
  if (!item) return null;
  const versions = await db
    .select()
    .from(itemVersions)
    .where(eq(itemVersions.itemId, itemId))
    .orderBy(desc(itemVersions.number));
  const current = versions.find((version) => version.id === item.currentVersionId);
  return {
    id: item.id,
    status: item.status,
    channel: item.channel,
    format: item.format,
    pillar: item.pillar,
    angle: item.angle,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    currentVersionNumber: current?.number ?? null,
    text: current ? itemText(item.format, current.copy as FormatCopy) : null,
    versions: versions.map((version) => ({
      number: version.number,
      author: version.author,
      createdAt: version.createdAt.toISOString(),
      copy: version.copy,
      assetIds: version.assetIds,
    })),
  };
}
