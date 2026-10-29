// India Standard Time has no daylight saving: UTC+05:30 all year.
export const IST_OFFSET_MIN = 330;
const DAY_MS = 864e5;
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface IstNow { date: string; min: number }

export function nowIst(now: Date = new Date()): IstNow {
  const t = new Date(now.getTime() + IST_OFFSET_MIN * 6e4);
  return { date: t.toISOString().slice(0, 10), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}
export function dowOf(date: string): number { return new Date(date + "T00:00:00Z").getUTCDay(); }

/** The UTC instant of an IST wall-clock time. */
export function istToUtc(date: string, min: number): Date {
  return new Date(Date.parse(date + "T00:00:00Z") + (min - IST_OFFSET_MIN) * 6e4);
}
export function hoursUntil(date: string, min: number, now: Date = new Date()): number {
  return (istToUtc(date, min).getTime() - now.getTime()) / 36e5;
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
export function fmtDate(date: string, long = false): string {
  const d = new Date(date + "T00:00:00Z");
  return long
    ? `${DOW_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    : `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function relDay(date: string, today: string): string {
  const n = daysBetween(today, date);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : fmtDate(date);
}
