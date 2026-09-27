import "server-only";
import { db } from "@/lib/db";
import { type Conflict, detectConflicts, publishBlockers } from "@/domain/conflicts";
import { dayCoverage, gapRanges, type CoverageHour } from "@/domain/coverage";
import { costShifts, type LaborSummary, paidMinutes, summarize } from "@/domain/labor";
import {
  addDays, fromDbDate, localDateOf, localMinuteOf, minutesBetween, weekDates, weekInterval, weekStartOf,
} from "@/domain/time";
import { type Actor, ForbiddenError, canManageLocation, canViewLocation } from "@/server/authz/policy";

export interface BoardShift {
  id: string;
  userId: string | null;
  positionId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  notes: string | null;
  day: string;
  /** Local minutes after midnight of `day`; `endMin` may pass 1440 for overnight shifts. */
  startMin: number;
  endMin: number;
  paidMinutes: number;
  costCents: number | null;
  overtimeMinutes: number;
  conflicts: Pick<Conflict, "kind" | "severity" | "detail" | "overridden" | "relatedShiftId">[];
}

export interface BoardPerson {
  id: string;
  name: string;
  isMember: boolean;
  rateCents: number | null;
  weekMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: boolean;
}

export interface Busy {
  userId: string;
  day: string;
  startMin: number;
  endMin: number;
  label: string;
}

export interface Board {
  location: { id: string; name: string; timezone: string; weeklyBudgetCents: number | null; openMinute: number; closeMinute: number };
  locations: { id: string; name: string }[];
  weekStart: string;
  thisWeek: string;
  days: string[];
  status: "NONE" | "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  canEdit: boolean;
  /** Employees can't see a draft week at all. */
  hidden: boolean;
  rules: { overtimeThresholdMinutes: number; overtimeMultiplierPercent: number; minRestMinutes: number; minCoverage: number };
  positions: { id: string; name: string; color: string }[];
  people: BoardPerson[];
  shifts: BoardShift[];
  elsewhere: Busy[];
  unavailable: Busy[];
  timeOff: { userId: string; day: string }[];
  coverage: Record<string, { hours: CoverageHour[]; gaps: [number, number][] }>;
  labor: (LaborSummary & { lastWeek: { scheduledMinutes: number; totalCents: number } | null }) | null;
  blockers: { conflicts: number; overtime: { userId: string; overtimeMinutes: number }[] };
}

const MINUTE = 60_000;

function localSpan(startsAt: Date, endsAt: Date, tz: string) {
  const startMin = localMinuteOf(startsAt, tz);
  return { day: localDateOf(startsAt, tz), startMin, endMin: startMin + minutesBetween(startsAt, endsAt) };
}

function fmtRange(startsAt: Date, endsAt: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return `${f.format(startsAt)}–${f.format(endsAt)}`.replace(/ (AM|PM)/g, "");
}

/**
 * Everyone's shifts that touch a window, any store. Workweek totals count every store because
 * overtime is per person, not per store.
 */
async function shiftsFor(userIds: string[], from: Date, to: Date) {
  return db.shift.findMany({
    where: { userId: { in: userIds }, startsAt: { lt: to }, endsAt: { gt: from } },
    include: { location: { select: { id: true, name: true, timezone: true } } },
  });
}

async function laborFor(locationId: string, tz: string, weekStart: string, org: { overtimeThresholdMinutes: number; overtimeMultiplierPercent: number; weekStartsOn: number }) {
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

export async function getBoard(actor: Actor, locationId: string, weekInput?: string, now = new Date()): Promise<Board> {
  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location || !canViewLocation(actor, locationId)) throw new ForbiddenError();
  const canEdit = canManageLocation(actor, locationId);
  const org = await db.organization.findFirstOrThrow();
  const tz = location.timezone;
  const thisWeek = weekStartOf(localDateOf(now, tz), org.weekStartsOn);
  const weekStart = weekStartOf(weekInput && /^\d{4}-\d{2}-\d{2}$/.test(weekInput) ? weekInput : thisWeek, org.weekStartsOn);
  const days = weekDates(weekStart);
  const { start, end } = weekInterval(weekStart, tz);

  const visibleLocations = await db.location.findMany({
    where: { archivedAt: null, ...(actor.role === "ADMIN" ? {} : { id: { in: [...new Set([...actor.memberLocationIds, actor.managedLocationId ?? ""])] } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const week = await db.scheduleWeek.findUnique({ where: { locationId_weekStart: { locationId, weekStart: new Date(`${weekStart}T00:00:00Z`) } } });
  const status = week?.status ?? "NONE";
  const hidden = !canEdit && status !== "PUBLISHED";
  const positions = await db.position.findMany({ where: { locationId, archivedAt: null }, orderBy: { name: "asc" } });
  const rules = {
    overtimeThresholdMinutes: org.overtimeThresholdMinutes, overtimeMultiplierPercent: org.overtimeMultiplierPercent,
    minRestMinutes: org.minRestMinutes, minCoverage: org.minCoverage,
  };
  const base = {
    location: { id: location.id, name: location.name, timezone: tz, weeklyBudgetCents: canEdit ? location.weeklyBudgetCents : null, openMinute: location.openMinute, closeMinute: location.closeMinute },
    locations: visibleLocations, weekStart, thisWeek, days, status, publishedAt: week?.publishedAt?.toISOString() ?? null,
    canEdit, hidden, rules, positions: positions.map((p) => ({ id: p.id, name: p.name, color: p.color })),
  } as const;
  if (hidden) {
    return { ...base, people: [], shifts: [], elsewhere: [], unavailable: [], timeOff: [], coverage: {}, labor: null, blockers: { conflicts: 0, overtime: [] } };
  }

  const shiftsHere = await db.shift.findMany({ where: { locationId, startsAt: { gte: start, lt: end } }, orderBy: { startsAt: "asc" } });
  const members = await db.employeeLocation.findMany({
    where: { locationId, user: { status: { not: "DEACTIVATED" }, role: "EMPLOYEE" } },
    include: { user: { select: { id: true, name: true } } },
  });
  const memberIds = new Set(members.map((m) => m.userId));
  const scheduledIds = shiftsHere.flatMap((s) => (s.userId ? [s.userId] : []));
  const userIds = [...new Set([...memberIds, ...scheduledIds])];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, payRates: true, locations: { select: { locationId: true } } },
  });

  // A day either side so short-rest checks see the neighbouring shifts.
  const ctxFrom = new Date(start.getTime() - 24 * 60 * MINUTE);
  const ctxTo = new Date(end.getTime() + 24 * 60 * MINUTE);
  const around = await shiftsFor(userIds, ctxFrom, ctxTo);
  const allForConflicts = [...around, ...shiftsHere.filter((s) => !s.userId).map((s) => ({ ...s, location }))];
  const tzById = new Map(around.map((s) => [s.locationId, s.location.timezone]));
  tzById.set(location.id, tz);
  const nameById = new Map(around.map((s) => [s.locationId, s.location.name]));
  nameById.set(location.id, location.name);

  const unavailability = await db.availability.findMany({
    where: { userId: { in: userIds }, kind: "UNAVAILABLE", effectiveFrom: { lte: new Date(`${addDays(weekStart, 7)}T00:00:00Z`) } },
  });
  const timeOff = await db.timeOffRequest.findMany({
    where: { userId: { in: userIds }, status: "APPROVED", startsAt: { lt: ctxTo }, endsAt: { gt: ctxFrom } },
  });
  const overrides = await db.conflictOverride.findMany({ where: { shiftId: { in: shiftsHere.map((s) => s.id) } } });
  const approvals = await db.overtimeApproval.findMany({
    where: { userId: { in: userIds }, weekStart: new Date(`${weekStart}T00:00:00Z`) },
  });

  const conflicts = detectConflicts({
    shifts: allForConflicts,
    checkShiftIds: new Set(shiftsHere.map((s) => s.id)),
    unavailability: unavailability.map((a) => ({
      userId: a.userId, dayOfWeek: a.dayOfWeek, startMinute: a.startMinute, endMinute: a.endMinute, kind: a.kind,
      effectiveFrom: fromDbDate(a.effectiveFrom), effectiveTo: a.effectiveTo ? fromDbDate(a.effectiveTo) : null,
    })),
    approvedTimeOff: timeOff,
    membership: (u) => users.find((x) => x.id === u)?.locations.map((l) => l.locationId) ?? [],
    tzOf: (id) => tzById.get(id) ?? tz,
    locationName: (id) => nameById.get(id) ?? "another store",
    minRestMinutes: org.minRestMinutes,
    overrides,
  });

  const inWeek = around.filter((s) => s.startsAt >= start && s.startsAt < end);
  const ratesOf = (u: string) =>
    (users.find((x) => x.id === u)?.payRates ?? []).map((r) => ({ hourlyRateCents: r.hourlyRateCents, effectiveFrom: fromDbDate(r.effectiveFrom) }));
  const { shifts: costs, weeks } = costShifts(inWeek, { ...org, tzOf: (id) => tzById.get(id) ?? tz, ratesOf });
  const costById = new Map(costs.map((c) => [c.shiftId, c]));
  const weekByUser = new Map(weeks.map((w) => [w.userId, w]));

  const people: BoardPerson[] = users
    .map((u) => {
      const w = weekByUser.get(u.id);
      const approval = approvals.find((a) => a.userId === u.id);
      const minutes = w?.scheduledMinutes ?? 0;
      const rate = costs.find((c) => c.userId === u.id)?.rateCents ?? ratesOf(u.id).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]?.hourlyRateCents ?? null;
      return {
        id: u.id, name: u.name, isMember: memberIds.has(u.id), rateCents: canEdit ? rate : null,
        weekMinutes: minutes, overtimeMinutes: w?.overtimeMinutes ?? 0,
        overtimeApproved: !!approval && approval.approvedMinutes >= minutes,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const shifts: BoardShift[] = shiftsHere.map((s) => {
    const c = costById.get(s.id);
    return {
      id: s.id, userId: s.userId, positionId: s.positionId, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(),
      breakMinutes: s.breakMinutes, notes: s.notes, ...localSpan(s.startsAt, s.endsAt, tz), paidMinutes: paidMinutes(s),
      costCents: canEdit ? (c ? c.regularCents + c.overtimeCents : null) : null,
      overtimeMinutes: c?.overtimeMinutes ?? 0,
      conflicts: canEdit
        ? conflicts.filter((x) => x.shiftId === s.id).map(({ kind, severity, detail, overridden, relatedShiftId }) => ({ kind, severity, detail, overridden, relatedShiftId }))
        : [],
    };
  });

  const elsewhere: Busy[] = around
    .filter((s) => s.locationId !== locationId && s.startsAt < end && s.endsAt > start)
    .map((s) => ({ userId: s.userId!, ...localSpan(s.startsAt, s.endsAt, tz), label: `${s.location.name} ${fmtRange(s.startsAt, s.endsAt, tz)}` }));

  const unavailable: Busy[] = [];
  for (const a of unavailability) {
    for (const day of days) {
      const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (dow !== a.dayOfWeek || day < fromDbDate(a.effectiveFrom) || (a.effectiveTo && day > fromDbDate(a.effectiveTo))) continue;
      unavailable.push({ userId: a.userId, day, startMin: a.startMinute, endMin: a.endMinute, label: a.startMinute === 0 && a.endMinute === 1440 ? "Unavailable" : "Unavailable part of the day" });
    }
  }
  // A day counts as "time off" if any approved request overlaps it in the store's zone.
  const off = timeOff.flatMap((t) => {
    const first = localDateOf(t.startsAt, tz);
    const last = localDateOf(new Date(t.endsAt.getTime() - 1), tz);
    return days.filter((d) => d >= first && d <= last).map((d) => ({ userId: t.userId, day: d }));
  });

  const coverage: Board["coverage"] = {};
  for (const day of days) {
    const spans = shifts.filter((s) => s.day === day && s.userId);
    const hours = dayCoverage(spans, { openMinute: location.openMinute, closeMinute: location.closeMinute, minCoverage: org.minCoverage });
    coverage[day] = { hours, gaps: gapRanges(hours) };
  }

  let labor: Board["labor"] = null;
  if (canEdit) {
    const hereCosts = costs.filter((c) => c.locationId === locationId);
    const summary = summarize(hereCosts, shiftsHere.filter((s) => !s.userId));
    const prev = await laborFor(locationId, tz, addDays(weekStart, -7), org);
    const prevHere = prev.costs.shifts.filter((c) => c.locationId === locationId);
    const prevSummary = prev.here.length ? summarize(prevHere) : null;
    labor = { ...summary, lastWeek: prevSummary && { scheduledMinutes: prevSummary.scheduledMinutes, totalCents: prevSummary.totalCents } };
  }

  const scheduledHere = new Set(scheduledIds);
  const { blocking } = publishBlockers(conflicts);
  return {
    ...base, people, shifts, elsewhere, unavailable, timeOff: off, coverage, labor,
    blockers: {
      conflicts: new Set(blocking.map((c) => c.shiftId)).size,
      overtime: people.filter((p) => scheduledHere.has(p.id) && p.overtimeMinutes > 0 && !p.overtimeApproved)
        .map((p) => ({ userId: p.id, overtimeMinutes: p.overtimeMinutes })),
    },
  };
}
