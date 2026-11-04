import 'server-only';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
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
  versions: ItemVersionEntry[];
};

function cardTitle(copy: unknown): string | null {
  if (!copy || typeof copy !== 'object') return null;
  const fields = copy as Record<string, unknown>;
  const firstSlide = Array.isArray(fields.slides) ? (fields.slides[0] as Record<string, unknown> | undefined) : undefined;
  const title = [fields.headline, fields.subject, fields.seoTitle, firstSlide?.title, fields.caption].find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return title ?? null;
}

export async function loadBoard(db: Database, brandId: string): Promise<BoardCard[]> {
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
    .where(and(eq(contentItems.brandId, brandId), ne(contentItems.status, 'rejected')))
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
    title: cardTitle(item.copy),
    imageAssetId: item.assetIds?.[0] ?? null,
    run: latestRuns.get(item.id) ?? null,
  }));
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
  return {
    id: item.id,
    status: item.status,
    channel: item.channel,
    format: item.format,
    pillar: item.pillar,
    angle: item.angle,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    currentVersionNumber: versions.find((version) => version.id === item.currentVersionId)?.number ?? null,
    versions: versions.map((version) => ({
      number: version.number,
      author: version.author,
      createdAt: version.createdAt.toISOString(),
      copy: version.copy,
      assetIds: version.assetIds,
    })),
  };
}
