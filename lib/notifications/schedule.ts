// When is a scheduled Teams notification due? All times are WIB (UTC+7, no DST).
//
// The runner (/api/cron/notifications) may run every 15 minutes (Kubernetes CronJob) or once a day
// (Vercel Hobby cron, 07:00 WIB). Each run sends whatever became due since it was last sent, so the
// same code serves both — on a daily runner a 09:00 schedule goes out at the next 07:00 run.

const WIB_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A missed schedule older than this is skipped, not sent late. */
export const CATCH_UP_MS = DAY_MS;

/**
 * Most recent scheduled moment ≤ now (epoch ms).
 * weekday: 1 = Monday … 7 = Sunday for a weekly schedule; omit for daily.
 */
export function lastOccurrence(now: number, time: string, weekday?: number): number {
  const [hh, mm] = time.split(":").map(Number);
  const wib = new Date(now + WIB_MS); // read its UTC fields as WIB wall-clock fields
  let at = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), hh, mm) - WIB_MS;
  if (at > now) at -= DAY_MS;
  if (weekday) {
    const isoDay = (t: number) => ((new Date(t + WIB_MS).getUTCDay() + 6) % 7) + 1;
    while (isoDay(at) !== weekday) at -= DAY_MS;
  }
  return at;
}

/** Due when the latest occurrence has not been sent yet and is recent enough to still be useful. */
export function isDue(now: number, lastSent: number | undefined, time: string, weekday?: number): boolean {
  const at = lastOccurrence(now, time, weekday);
  return (lastSent ?? 0) < at && now - at <= CATCH_UP_MS;
}

/** WIB calendar date (YYYY-MM-DD) `daysBack` days before now. */
export function wibDate(now: number, daysBack = 0): string {
  return new Date(now + WIB_MS - daysBack * DAY_MS).toISOString().slice(0, 10);
}
