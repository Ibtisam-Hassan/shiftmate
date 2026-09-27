import { rateOn } from "./pay";
import { localDateOf, minutesBetween, weekStartOf } from "./time";

export interface PaidShift {
  id: string;
  userId: string | null;
  locationId: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
}

export interface OvertimeRules {
  overtimeThresholdMinutes: number;
  overtimeMultiplierPercent: number;
  weekStartsOn: number;
}

export function paidMinutes(s: Pick<PaidShift, "startsAt" | "endsAt" | "breakMinutes">): number {
  return Math.max(0, minutesBetween(s.startsAt, s.endsAt) - s.breakMinutes);
}

/** The workweek a shift belongs to: the week containing its start, in its store's zone. */
export function workweekOf(s: Pick<PaidShift, "startsAt" | "locationId">, tzOf: (locationId: string) => string, weekStartsOn: number) {
  return weekStartOf(localDateOf(s.startsAt, tzOf(s.locationId)), weekStartsOn);
}

export interface ShiftCost {
  shiftId: string;
  userId: string;
  locationId: string;
  regularMinutes: number;
  overtimeMinutes: number;
  rateCents: number | null;
  regularCents: number;
  overtimeCents: number;
}

export interface WeekTotals {
  userId: string;
  weekStart: string;
  scheduledMinutes: number;
  overtimeMinutes: number;
}

/**
 * Splits each person's workweek into regular and overtime minutes, then prices them.
 *
 * Overtime is the minutes past the threshold, counted in time order, so it lands on the
 * person's last shifts of the week, whichever store those are at. That store carries the
 * premium. Each shift is priced at the rate in force on its local start date.
 * (Simplification: US law uses a blended "regular rate" when someone has several rates in one
 * week; we price overtime at the rate of the shift it falls in.)
 */
export function costShifts(
  shifts: PaidShift[],
  opts: OvertimeRules & {
    tzOf: (locationId: string) => string;
    ratesOf: (userId: string) => { hourlyRateCents: number; effectiveFrom: string }[];
  },
): { shifts: ShiftCost[]; weeks: WeekTotals[] } {
  const byWeek = new Map<string, PaidShift[]>();
  for (const s of shifts) {
    if (!s.userId) continue;
    const key = `${s.userId}|${workweekOf(s, opts.tzOf, opts.weekStartsOn)}`;
    byWeek.set(key, [...(byWeek.get(key) ?? []), s]);
  }
  const out: ShiftCost[] = [];
  const weeks: WeekTotals[] = [];
  const mult = opts.overtimeMultiplierPercent / 100;
  for (const [key, list] of byWeek) {
    const [userId, weekStart] = key.split("|");
    list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    let running = 0;
    for (const s of list) {
      const paid = paidMinutes(s);
      const regular = Math.max(0, Math.min(paid, opts.overtimeThresholdMinutes - running));
      const overtime = paid - regular;
      running += paid;
      const rate = rateOn(opts.ratesOf(userId), localDateOf(s.startsAt, opts.tzOf(s.locationId)));
      out.push({
        shiftId: s.id, userId, locationId: s.locationId, regularMinutes: regular, overtimeMinutes: overtime,
        rateCents: rate,
        regularCents: rate == null ? 0 : Math.round((regular * rate) / 60),
        overtimeCents: rate == null ? 0 : Math.round((overtime * rate * mult) / 60),
      });
    }
    weeks.push({ userId, weekStart, scheduledMinutes: running, overtimeMinutes: Math.max(0, running - opts.overtimeThresholdMinutes) });
  }
  return { shifts: out, weeks };
}

export interface LaborSummary {
  scheduledMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  regularCents: number;
  overtimeCents: number;
  totalCents: number;
  /** Shifts whose person has no pay rate yet: their cost is missing from the totals. */
  unpricedShifts: number;
  openShifts: number;
  openMinutes: number;
}

export function summarize(costs: ShiftCost[], openShifts: PaidShift[] = []): LaborSummary {
  const s: LaborSummary = {
    scheduledMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, regularCents: 0, overtimeCents: 0, totalCents: 0,
    unpricedShifts: 0, openShifts: openShifts.length, openMinutes: openShifts.reduce((a, x) => a + paidMinutes(x), 0),
  };
  for (const c of costs) {
    s.regularMinutes += c.regularMinutes;
    s.overtimeMinutes += c.overtimeMinutes;
    s.regularCents += c.regularCents;
    s.overtimeCents += c.overtimeCents;
    if (c.rateCents == null) s.unpricedShifts++;
  }
  s.scheduledMinutes = s.regularMinutes + s.overtimeMinutes;
  s.totalCents = s.regularCents + s.overtimeCents;
  return s;
}
