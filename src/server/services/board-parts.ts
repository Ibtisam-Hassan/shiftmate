import "server-only";
import { db } from "@/lib/db";
import { costShifts } from "@/domain/labor";
import { fromDbDate, localDateOf, localMinuteOf, minutesBetween, weekInterval } from "@/domain/time";

export function localSpan(startsAt: Date, endsAt: Date, tz: string) {
  const startMin = localMinuteOf(startsAt, tz);
  return { day: localDateOf(startsAt, tz), startMin, endMin: startMin + minutesBetween(startsAt, endsAt) };
}

export function fmtRange(startsAt: Date, endsAt: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return `${f.format(startsAt)}–${f.format(endsAt)}`.replace(/ (AM|PM)/g, "");
}

/**
 * Everyone's shifts that touch a window, any store. Workweek totals count every store because
 * overtime is per person, not per store.
 */
export async function shiftsFor(userIds: string[], from: Date, to: Date) {
  return db.shift.findMany({
    where: { userId: { in: userIds }, startsAt: { lt: to }, endsAt: { gt: from } },
    include: { location: { select: { id: true, name: true, timezone: true } } },
  });
}

export async function laborFor(locationId: string, tz: string, weekStart: string, org: { overtimeThresholdMinutes: number; overtimeMultiplierPercent: number; weekStartsOn: number }) {
  const { start, end } = weekInterval(weekStart, tz);
  const here = await db.shift.findMany({ where: { locationId, startsAt: { gte: start, lt: end } } });
  const userIds = [...new Set(here.flatMap((s) => (s.userId ? [s.userId] : [])))];
  const all = await db.shift.findMany({
    where: { userId: { in: userIds }, startsAt: { gte: start, lt: end } },
    include: { location: { select: { timezone: true } } },
  });
  const rates = await db.payRate.findMany({ where: { userId: { in: userIds } } });
  const tzById = new Map(all.map((s) => [s.locationId, s.location.timezone]));
  const costs = costShifts(all, {
    ...org,
    tzOf: (id) => tzById.get(id) ?? tz,
    ratesOf: (u) => rates.filter((r) => r.userId === u).map((r) => ({ hourlyRateCents: r.hourlyRateCents, effectiveFrom: fromDbDate(r.effectiveFrom) })),
  });
  return { costs, here };
}

type Unavailability = { userId: string; dayOfWeek: number; startMinute: number; endMinute: number; effectiveFrom: Date; effectiveTo: Date | null };

/** Recurring "can't work" windows, expanded onto the days of this week. */
export function unavailableDays(rows: Unavailability[], days: string[]) {
  return rows.flatMap((a) =>
    days
      .filter((day) => {
        const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
        return dow === a.dayOfWeek && day >= fromDbDate(a.effectiveFrom) && (!a.effectiveTo || day <= fromDbDate(a.effectiveTo));
      })
      .map((day) => ({
        userId: a.userId, day, startMin: a.startMinute, endMin: a.endMinute,
        label: a.startMinute === 0 && a.endMinute === 1440 ? "Unavailable" : "Unavailable part of the day",
      })),
  );
}

/** A day counts as time off if any approved request overlaps it in the store's zone. */
export function timeOffDays(requests: { userId: string; startsAt: Date; endsAt: Date }[], days: string[], tz: string) {
  return requests.flatMap((t) => {
    const first = localDateOf(t.startsAt, tz);
    const last = localDateOf(new Date(t.endsAt.getTime() - 1), tz);
    return days.filter((d) => d >= first && d <= last).map((d) => ({ userId: t.userId, day: d }));
  });
}
