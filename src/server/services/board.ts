import "server-only";
import { db } from "@/lib/db";
import { detectConflicts, publishBlockers } from "@/domain/conflicts";
import { dayCoverage, gapRanges } from "@/domain/coverage";
import { costShifts, paidMinutes, summarize } from "@/domain/labor";
import { rateOn } from "@/domain/pay";
import { addDays, fromDbDate, localDateOf, weekDates, weekInterval, weekStartOf } from "@/domain/time";
import { type Actor, ForbiddenError, canManageLocation, canViewLocation } from "@/server/authz/policy";
import { fmtRange, laborFor, localSpan, mainPositions, shiftsFor, timeOffDays, unavailableDays } from "./board-parts";
import type { Board, BoardPerson, BoardShift } from "./board-types";

export type { Board, BoardPerson, BoardShift, Busy } from "./board-types";

const DAY_MS = 24 * 60 * 60_000;
const dbDate = (d: string) => new Date(`${d}T00:00:00Z`);

async function visibleStores(actor: Actor) {
  const mine = [...new Set([...actor.memberLocationIds, actor.managedLocationId ?? ""])];
  return db.location.findMany({
    where: { archivedAt: null, ...(actor.role === "ADMIN" ? {} : { id: { in: mine } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Everything the schedule page shows for one store and week. Employees get no pay, costs or drafts. */
export async function getBoard(actor: Actor, locationId: string, weekInput?: string, now = new Date()): Promise<Board> {
  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location || !canViewLocation(actor, locationId)) throw new ForbiddenError();
  const canEdit = canManageLocation(actor, locationId);
  const org = await db.organization.findFirstOrThrow();
  const tz = location.timezone;
  const thisWeek = weekStartOf(localDateOf(now, tz), org.weekStartsOn);
  const weekStart = weekStartOf(weekInput?.match(/^\d{4}-\d{2}-\d{2}$/) ? weekInput : thisWeek, org.weekStartsOn);
  const days = weekDates(weekStart);
  const { start, end } = weekInterval(weekStart, tz);

  const week = await db.scheduleWeek.findUnique({ where: { locationId_weekStart: { locationId, weekStart: dbDate(weekStart) } } });
  const status = week?.status ?? "NONE";
  const hidden = !canEdit && status !== "PUBLISHED";
  const positions = await db.position.findMany({ where: { locationId, archivedAt: null }, orderBy: { name: "asc" } });
  const base = {
    location: {
      id: location.id, name: location.name, timezone: tz, openMinute: location.openMinute, closeMinute: location.closeMinute,
      weeklyBudgetCents: canEdit ? location.weeklyBudgetCents : null,
    },
    locations: await visibleStores(actor), weekStart, thisWeek, days, status, canEdit, hidden,
    publishedAt: week?.publishedAt?.toISOString() ?? null,
    rules: {
      overtimeThresholdMinutes: org.overtimeThresholdMinutes, overtimeMultiplierPercent: org.overtimeMultiplierPercent,
      minRestMinutes: org.minRestMinutes, minCoverage: org.minCoverage,
    },
    positions: positions.map((p) => ({ id: p.id, name: p.name, color: p.color })),
  } as const;
  if (hidden) {
    return { ...base, people: [], shifts: [], elsewhere: [], unavailable: [], timeOff: [], coverage: {}, labor: null, blockers: { conflicts: 0, overtime: [] } };
  }

  // Who: this store's staff plus anyone scheduled here this week.
  const shiftsHere = await db.shift.findMany({ where: { locationId, startsAt: { gte: start, lt: end } }, orderBy: { startsAt: "asc" } });
  const members = await db.employeeLocation.findMany({ where: { locationId, user: { status: { not: "DEACTIVATED" }, role: "EMPLOYEE" } } });
  const memberIds = new Set(members.map((m) => m.userId));
  const scheduledIds = new Set(shiftsHere.flatMap((s) => (s.userId ? [s.userId] : [])));
  const userIds = [...new Set([...memberIds, ...scheduledIds])];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, payRates: true, locations: { select: { locationId: true } } },
  });

  // Their shifts anywhere, with a day either side so short-rest checks see neighbours.
  const from = new Date(start.getTime() - DAY_MS);
  const to = new Date(end.getTime() + DAY_MS);
  const around = await shiftsFor(userIds, from, to);
  const tzById = new Map([...around.map((s) => [s.locationId, s.location.timezone] as const), [location.id, tz]]);
  const nameById = new Map([...around.map((s) => [s.locationId, s.location.name] as const), [location.id, location.name]]);
  const unavailability = await db.availability.findMany({ where: { userId: { in: userIds }, kind: "UNAVAILABLE", effectiveFrom: { lte: dbDate(addDays(weekStart, 7)) } } });
  const timeOff = await db.timeOffRequest.findMany({ where: { userId: { in: userIds }, status: "APPROVED", startsAt: { lt: to }, endsAt: { gt: from } } });
  const overrides = await db.conflictOverride.findMany({ where: { shiftId: { in: shiftsHere.map((s) => s.id) } } });
  const approvals = await db.overtimeApproval.findMany({ where: { userId: { in: userIds }, weekStart: dbDate(weekStart) } });

  const conflicts = detectConflicts({
    shifts: [...around, ...shiftsHere.filter((s) => !s.userId)],
    checkShiftIds: new Set(shiftsHere.map((s) => s.id)),
    unavailability: unavailability.map((a) => ({ ...a, effectiveFrom: fromDbDate(a.effectiveFrom), effectiveTo: a.effectiveTo && fromDbDate(a.effectiveTo) })),
    approvedTimeOff: timeOff,
    membership: (u) => users.find((x) => x.id === u)?.locations.map((l) => l.locationId) ?? [],
    tzOf: (id) => tzById.get(id) ?? tz,
    locationName: (id) => nameById.get(id) ?? "another store",
    minRestMinutes: org.minRestMinutes,
    overrides,
  });

  // Hours and cost count every store: overtime is per person, not per store.
  const ratesOf = (u: string) =>
    (users.find((x) => x.id === u)?.payRates ?? []).map((r) => ({ hourlyRateCents: r.hourlyRateCents, effectiveFrom: fromDbDate(r.effectiveFrom) }));
  const inWeek = around.filter((s) => s.startsAt >= start && s.startsAt < end);
  const { shifts: costs, weeks } = costShifts(inWeek, { ...org, tzOf: (id) => tzById.get(id) ?? tz, ratesOf });

  const mains = await mainPositions(locationId, userIds, end);
  const people: BoardPerson[] = users.map((u) => {
    const w = weeks.find((x) => x.userId === u.id);
    const minutes = w?.scheduledMinutes ?? 0;
    const approval = approvals.find((a) => a.userId === u.id);
    return {
      id: u.id, name: u.name, isMember: memberIds.has(u.id),
      rateCents: canEdit ? rateOn(ratesOf(u.id), localDateOf(now, tz)) : null,
      weekMinutes: minutes, overtimeMinutes: w?.overtimeMinutes ?? 0,
      overtimeApproved: !!approval && approval.approvedMinutes >= minutes,
      mainPositionId: mains.get(u.id) ?? null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const shifts: BoardShift[] = shiftsHere.map((s) => {
    const c = costs.find((x) => x.shiftId === s.id);
    return {
      id: s.id, userId: s.userId, positionId: s.positionId, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(),
      breakMinutes: s.breakMinutes, notes: s.notes, ...localSpan(s.startsAt, s.endsAt, tz), paidMinutes: paidMinutes(s),
      costCents: canEdit && c ? c.regularCents + c.overtimeCents : null,
      overtimeMinutes: c?.overtimeMinutes ?? 0,
      conflicts: canEdit ? conflicts.filter((x) => x.shiftId === s.id).map(({ kind, severity, detail, overridden, relatedShiftId }) => ({ kind, severity, detail, overridden, relatedShiftId })) : [],
    };
  });

  const coverage: Board["coverage"] = Object.fromEntries(days.map((day) => {
    const hours = dayCoverage(shifts.filter((s) => s.day === day && s.userId), { ...location, minCoverage: org.minCoverage });
    return [day, { hours, gaps: gapRanges(hours) }];
  }));

  let labor: Board["labor"] = null;
  if (canEdit) {
    const prev = await laborFor(locationId, tz, addDays(weekStart, -7), org);
    const last = prev.here.length ? summarize(prev.costs.shifts.filter((c) => c.locationId === locationId)) : null;
    labor = {
      ...summarize(costs.filter((c) => c.locationId === locationId), shiftsHere.filter((s) => !s.userId)),
      lastWeek: last && { scheduledMinutes: last.scheduledMinutes, totalCents: last.totalCents },
    };
  }

  return {
    ...base, people, shifts, coverage, labor,
    elsewhere: around
      .filter((s) => s.locationId !== locationId && s.startsAt < end && s.endsAt > start)
      .map((s) => ({ userId: s.userId!, ...localSpan(s.startsAt, s.endsAt, tz), label: `${s.location.name} ${fmtRange(s.startsAt, s.endsAt, tz)}` })),
    unavailable: unavailableDays(unavailability, days),
    timeOff: timeOffDays(timeOff, days, tz),
    blockers: {
      conflicts: new Set(publishBlockers(conflicts).blocking.map((c) => c.shiftId)).size,
      overtime: people.filter((p) => scheduledIds.has(p.id) && p.overtimeMinutes > 0 && !p.overtimeApproved)
        .map((p) => ({ userId: p.id, overtimeMinutes: p.overtimeMinutes })),
    },
  };
}
