export function moveToDay(iso: string, day: string) {
  const time = new Date(iso);
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(
    year,
    month - 1,
    date,
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  ).toISOString();
}
