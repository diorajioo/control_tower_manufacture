// Production day = 07:00 WIB until 07:00 WIB the next day (shift 1 starts at 07:00; user definition 2026-11-02).
// A timestamp before 07:00 belongs to the previous day, so a week runs Monday 07:00 → Monday 07:00 and a month
// starts at 07:00 on the 1st. Shared by the SQL (filters and week / month buckets) and the Header presets.
// The Snowflake session runs in WIB. DATE-only columns (the Output datamarts' CORRECTION_DATE) carry no time and
// stay as they are.

export const PROD_DAY_START_HOUR = 7;
const WIB_OFFSET_HOURS = 7;

/** SQL: the production day of a timestamp column or expression. */
export const prodDate = (col: string) => `DATEADD('hour', -${PROD_DAY_START_HOUR}, ${col})::DATE`;

/** SQL: today's production day. */
export const PROD_TODAY_SQL = prodDate("CURRENT_TIMESTAMP()");

/** The production day `offsetDays` from today, as a Date at 00:00 UTC — read it with the getUTC* methods. */
export function prodDay(offsetDays = 0): Date {
  const d = new Date(Date.now() + (WIB_OFFSET_HOURS - PROD_DAY_START_HOUR) * 3_600_000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

/** YYYY-MM-DD of a prodDay() date. */
export const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Today's production day, YYYY-MM-DD. */
export const prodToday = () => ymd(prodDay());

/** 1 January of the production day's year, YYYY-MM-DD. */
export const prodYearStart = () => `${prodDay().getUTCFullYear()}-01-01`;
