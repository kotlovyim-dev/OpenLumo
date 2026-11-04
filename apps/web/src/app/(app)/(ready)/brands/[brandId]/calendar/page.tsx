import type { Metadata } from 'next';
import { loadCalendarCards, loadItemDetail } from '@/features/board/board-service';
import { ItemDetailSheet } from '@/features/board/item-detail-sheet';
import { requireBrandAccessOrNotFound } from '@/features/brands/brand-access';
import { calendarRange, parseCalendarParams, todayKey } from '@/features/calendar/calendar-range';
import { CalendarView } from '@/features/calendar/calendar-view';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'Calendar' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ view?: string | string[]; date?: string | string[]; item?: string | string[] }>;
}) {
  const { brandId } = await params;
  const { item, ...calendarParams } = await searchParams;
  const { db, user } = await getServerContext();
  const membership = await requireBrandAccessOrNotFound(db, user.id, brandId, 'viewer');
  const canEdit = membership.role !== 'viewer';
  const today = todayKey();
  const { view, date } = parseCalendarParams(calendarParams, today);
  const range = calendarRange(view, date);
  const cards = await loadCalendarCards(db, brandId, range.from, range.to);
  const detail = typeof item === 'string' ? await loadItemDetail(db, brandId, item) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      <CalendarView
        brandId={brandId}
        view={view}
        date={date}
        days={range.days}
        month={range.month}
        previous={range.previous}
        next={range.next}
        today={today}
        cards={cards.flatMap((card) => (card.scheduledAt ? [{ ...card, scheduledAt: card.scheduledAt }] : []))}
        canEdit={canEdit}
      />
      {detail && (
        <ItemDetailSheet
          key={`${detail.id}:${detail.currentVersionNumber}`}
          brandId={brandId}
          detail={detail}
          canEdit={canEdit}
          closeHref={`/brands/${brandId}/calendar?view=${view}&date=${date}`}
        />
      )}
    </div>
  );
}
