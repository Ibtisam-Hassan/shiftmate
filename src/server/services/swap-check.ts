import "server-only";
import { db } from "@/lib/db";
import { detectConflicts } from "@/domain/conflicts";
import { costShifts } from "@/domain/labor";
import { fromDbDate, weekInterval, weekStartOf, localDateOf } from "@/domain/time";

const DAY_MS = 86_400_000;

interface Move {
  shiftId: string;
  toUserId: string;
}

/**
 * Would these moves cause any problem? Returns plain reasons; an empty list means the swap is
 * clean and can apply without a manager. Blocking double-bookings count as problems too.
 */
export async function swapProblems(moves: Move[]): Promise<string[]> {
  const moved = await db.shift.findMany({ where: { id: { in: moves.map((m) => m.shiftId) } }, include: { location: true } });
  const userIds = [...new Set(moves.map((m) => m.toUserId))];
  const from = new Date(Math.min(...moved.map((s) => s.startsAt.getTime())) - 8 * DAY_MS);
  const to = new Date(Math.max(...moved.map((s) => s.endsAt.getTime())) + 8 * DAY_MS);

  const theirs = await db.shift.findMany({
    where: { userId: { in: userIds }, startsAt: { lt: to }, endsAt: { gt: from }, id: { notIn: moved.map((s) => s.id) } },
    include: { location: true },
  });
  // The schedule as it would be after the swap.
  const after = [...theirs, ...moved.map((s) => ({ ...s, userId: moves.find((m) => m.shiftId === s.id)!.toUserId }))];

  const [users, unavailability, timeOff, org] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, include: { locations: true, payRates: true } }),
    db.availability.findMany({ where: { userId: { in: userIds }, kind: "UNAVAILABLE" } }),
    db.timeOffRequest.findMany({ where: { userId: { in: userIds }, status: "APPROVED", startsAt: { lt: to }, endsAt: { gt: from } } }),
    db.organization.findFirstOrThrow(),
  ]);
  const tzOf = (id: string) => after.find((s) => s.locationId === id)?.location.timezone ?? "America/Chicago";
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? "Someone";

  const conflicts = detectConflicts({
    shifts: after,
    checkShiftIds: new Set(moved.map((s) => s.id)),
    unavailability: unavailability.map((a) => ({
      ...a, effectiveFrom: fromDbDate(a.effectiveFrom), effectiveTo: a.effectiveTo && fromDbDate(a.effectiveTo),
    })),
    approvedTimeOff: timeOff,
    membership: (u) => users.find((x) => x.id === u)?.locations.map((l) => l.locationId) ?? [],
    tzOf,
    locationName: (id) => after.find((s) => s.locationId === id)?.location.name ?? "another store",
    minRestMinutes: org.minRestMinutes,
  });
  const reasons = conflicts.map((c) => {
    const s = after.find((x) => x.id === c.shiftId)!;
    return `${nameOf(s.userId!)}: ${c.detail}`;
  });

  // Overtime: compare each person's workweek before and after.
  for (const userId of userIds) {
    const s = moved.find((m) => moves.find((x) => x.shiftId === m.id)?.toUserId === userId)!;
    const tz = s.location.timezone;
    const week = weekInterval(weekStartOf(localDateOf(s.startsAt, tz), org.weekStartsOn), tz);
    const inWeek = (list: typeof after) => list.filter((x) => x.userId === userId && x.startsAt >= week.start && x.startsAt < week.end);
    const minutes = (list: typeof after) => costShifts(inWeek(list), { ...org, tzOf, ratesOf: () => [] }).weeks[0]?.overtimeMinutes ?? 0;
    const before = [...theirs, ...moved].filter((x) => x.userId === userId);
    if (minutes(after) > minutes(before)) reasons.push(`${nameOf(userId)} would go into overtime.`);
  }
  return reasons;
}
