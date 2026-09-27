import { TZDate } from "@date-fns/tz";

/**
 * Calendar dates are plain "YYYY-MM-DD" strings (a store's local date); instants are Dates.
 * Calendar math runs in UTC on purpose so it never picks up the server's own time zone.
 */
export type LocalDate = string;

const DAY_MS = 86_400_000;

function parse(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return format(parse(date) + days * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: LocalDate): number {
  return new Date(parse(date)).getUTCDay();
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export function weekStartOf(date: LocalDate, weekStartsOn: number): LocalDate {
  const back = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -back);
}

export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** The store-local calendar date an instant falls on. */
export function localDateOf(instant: Date, tz: string): LocalDate {
  const z = new TZDate(instant.getTime(), tz);
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${z.getFullYear()}-${mm}-${dd}`;
}

/** Minutes after local midnight for an instant, in the given zone. */
export function localMinuteOf(instant: Date, tz: string): number {
  const z = new TZDate(instant.getTime(), tz);
  return z.getHours() * 60 + z.getMinutes();
}

/**
 * The instant of a local wall-clock time. `minute` may be ≥ 1440 to express "next day"
 * (e.g. an overnight shift ending 02:00 = 1560). Wall times inside a DST gap roll forward.
 */
export function atLocal(date: LocalDate, minute: number, tz: string): Date {
  const dayOffset = Math.floor(minute / 1440);
  const m = minute - dayOffset * 1440;
  const [y, mo, d] = addDays(date, dayOffset).split("-").map(Number);
  return new Date(new TZDate(y, mo - 1, d, Math.floor(m / 60), m % 60, tz).getTime());
}

/** [start, end) instants covering a local week in a store's zone. DST weeks are 167 or 169 h. */
export function weekInterval(weekStart: LocalDate, tz: string): { start: Date; end: Date } {
  return { start: atLocal(weekStart, 0, tz), end: atLocal(addDays(weekStart, 7), 0, tz) };
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
