import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { costShifts } from "@/domain/labor";
import { addDays, atLocal, localDateOf, localMinuteOf, toDbDate, weekInterval, weekStartOf } from "@/domain/time";
import { audit, notify } from "@/server/audit";
import { type Actor, ForbiddenError, assertCanManageLocation, canManageLocation } from "@/server/authz/policy";
import { UserError, isOverlapViolation } from "@/server/errors";
import { getBoard } from "./board";

type Tx = Prisma.TransactionClient;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const shiftInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: time,
  end: time,
  userId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  breakMinutes: z.coerce.number().int().min(0).max(120).default(0),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});
export type ShiftInput = z.input<typeof shiftInput>;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Wall-clock times on a store date → instants. An end at or before the start means "next day". */
function span(date: string, start: string, end: string, tz: string) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return { startsAt: atLocal(date, s, tz), endsAt: atLocal(date, e, tz), minutes: e - s };
}

async function loadLocation(actor: Actor, locationId: string) {
  assertCanManageLocation(actor, locationId);
  const loc = await db.location.findUnique({ where: { id: locationId } });
  if (!loc) throw new UserError("That store no longer exists.");
  return loc;
}

async function weekFor(tx: Tx, locationId: string, date: string) {
  const org = await tx.organization.findFirstOrThrow();
  const weekStart = weekStartOf(date, org.weekStartsOn);
  return tx.scheduleWeek.upsert({
    where: { locationId_weekStart: { locationId, weekStart: toDbDate(weekStart) } },
    create: { locationId, weekStart: toDbDate(weekStart) },
    update: {},
  });
}

async function checkAssignee(tx: Tx, userId: string | null | undefined) {
  if (!userId) return;
  const u = await tx.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
  if (!u || u.status === "DEACTIVATED") throw new UserError("That person can't be scheduled.");
}

async function checkPosition(tx: Tx, locationId: string, positionId: string | null | undefined) {
  if (!positionId) return;
  const p = await tx.position.findFirst({ where: { id: positionId, locationId } });
  if (!p) throw new UserError("Pick a position from this store.");
}

/** Published weeks change in place; the people affected hear about it in the app. */
async function tellIfPublished(tx: Tx, weekId: string, userIds: (string | null | undefined)[], title: string, locationName: string) {
  const week = await tx.scheduleWeek.findUnique({ where: { id: weekId } });
  if (week?.status !== "PUBLISHED") return;
  await notify(tx, userIds.filter((u): u is string => !!u), { type: "schedule.changed", title, body: `${locationName} schedule updated.`, href: "/my-shifts" });
}

function describe(startsAt: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(startsAt);
}

async function save<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isOverlapViolation(e)) throw new UserError("That person already has a shift at that time.");
    throw e;
  }
}

export async function createShift(actor: Actor, locationId: string, raw: ShiftInput) {
  const loc = await loadLocation(actor, locationId);
  const input = shiftInput.parse(raw);
  const { startsAt, endsAt, minutes } = span(input.date, input.start, input.end, loc.timezone);
  if (minutes > 16 * 60) throw new UserError("Shifts can't be longer than 16 hours.", { end: "Too long" });
  if (input.breakMinutes >= minutes) throw new UserError("The break is longer than the shift.", { breakMinutes: "Too long" });
  return save(() => db.$transaction(async (tx) => {
    await checkAssignee(tx, input.userId);
    await checkPosition(tx, locationId, input.positionId);
    const week = await weekFor(tx, locationId, input.date);
    const shift = await tx.shift.create({
      data: {
        scheduleWeekId: week.id, locationId, userId: input.userId ?? null, positionId: input.positionId ?? null,
        startsAt, endsAt, breakMinutes: input.breakMinutes, notes: input.notes || null,
      },
    });
    await audit(tx, actor, { action: "shift.create", entity: "Shift", entityId: shift.id, locationId, after: shift });
    await tellIfPublished(tx, week.id, [shift.userId], `New shift: ${describe(startsAt, loc.timezone)}`, loc.name);
    return { id: shift.id };
  }));
}

async function loadShift(actor: Actor, id: string) {
  const shift = await db.shift.findUnique({ where: { id }, include: { location: true } });
  if (!shift) throw new UserError("That shift no longer exists.");
  if (!canManageLocation(actor, shift.locationId)) throw new ForbiddenError();
  return shift;
}

export async function updateShift(actor: Actor, id: string, raw: ShiftInput) {
  const before = await loadShift(actor, id);
  const input = shiftInput.parse(raw);
  const tz = before.location.timezone;
  const { startsAt, endsAt, minutes } = span(input.date, input.start, input.end, tz);
  if (minutes > 16 * 60) throw new UserError("Shifts can't be longer than 16 hours.", { end: "Too long" });
  if (input.breakMinutes >= minutes) throw new UserError("The break is longer than the shift.", { breakMinutes: "Too long" });
  await save(() => db.$transaction(async (tx) => {
    await checkAssignee(tx, input.userId);
    await checkPosition(tx, before.locationId, input.positionId);
    const week = await weekFor(tx, before.locationId, input.date);
    const after = await tx.shift.update({
      where: { id },
      data: {
        scheduleWeekId: week.id, userId: input.userId ?? null, positionId: input.positionId ?? null,
        startsAt, endsAt, breakMinutes: input.breakMinutes, notes: input.notes || null,
      },
    });
    // A shift that moved or changed hands is a different decision: old overrides no longer apply.
    if (after.userId !== before.userId || +after.startsAt !== +before.startsAt || +after.endsAt !== +before.endsAt) {
      await tx.conflictOverride.deleteMany({ where: { shiftId: id } });
    }
    await audit(tx, actor, { action: "shift.update", entity: "Shift", entityId: id, locationId: before.locationId, before, after });
    await tellIfPublished(tx, week.id, [before.userId, after.userId], `Shift changed: ${describe(startsAt, tz)}`, before.location.name);
  }));
}

/** Drag and drop: keep the wall-clock times, change the day and/or the person. */
export async function moveShift(actor: Actor, id: string, target: { date: string; userId: string | null }) {
  const s = await loadShift(actor, id);
  const tz = s.location.timezone;
  const startMin = localMinuteOf(s.startsAt, tz);
  const length = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
  const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return updateShift(actor, id, {
    date: target.date, start: hh(startMin), end: hh((startMin + length) % 1440),
    userId: target.userId, positionId: s.positionId, breakMinutes: s.breakMinutes, notes: s.notes ?? "",
  });
}

export async function deleteShift(actor: Actor, id: string) {
  const s = await loadShift(actor, id);
  await db.$transaction(async (tx) => {
    await tx.shift.delete({ where: { id } });
    await audit(tx, actor, { action: "shift.delete", entity: "Shift", entityId: id, locationId: s.locationId, before: s });
    await tellIfPublished(tx, s.scheduleWeekId, [s.userId], `Shift removed: ${describe(s.startsAt, s.location.timezone)}`, s.location.name);
  });
}

export async function makeOpen(actor: Actor, id: string) {
  const s = await loadShift(actor, id);
  await db.$transaction(async (tx) => {
    await tx.shift.update({ where: { id }, data: { userId: null } });
    await tx.conflictOverride.deleteMany({ where: { shiftId: id } });
    await audit(tx, actor, { action: "shift.open", entity: "Shift", entityId: id, locationId: s.locationId, before: { userId: s.userId } });
    await tellIfPublished(tx, s.scheduleWeekId, [s.userId], `You're off: ${describe(s.startsAt, s.location.timezone)}`, s.location.name);
  });
}

export async function assignShift(actor: Actor, id: string, userId: string) {
  const s = await loadShift(actor, id);
  await save(() => db.$transaction(async (tx) => {
    await checkAssignee(tx, userId);
    await tx.shift.update({ where: { id }, data: { userId } });
    await tx.conflictOverride.deleteMany({ where: { shiftId: id } });
    await audit(tx, actor, { action: "shift.assign", entity: "Shift", entityId: id, locationId: s.locationId, before: { userId: s.userId }, after: { userId } });
    await tellIfPublished(tx, s.scheduleWeekId, [s.userId, userId], `Shift changed: ${describe(s.startsAt, s.location.timezone)}`, s.location.name);
  }));
}

const overrideInput = z.object({
  kind: z.enum(["UNAVAILABLE", "TIME_OFF", "SHORT_REST", "NOT_ASSIGNED_TO_LOCATION"]),
  reason: z.string().trim().min(3, "Add a short reason").max(200),
});

export async function keepAnyway(actor: Actor, shiftId: string, raw: z.input<typeof overrideInput>) {
  const s = await loadShift(actor, shiftId);
  const input = overrideInput.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.conflictOverride.upsert({
      where: { shiftId_kind: { shiftId, kind: input.kind } },
      create: { shiftId, kind: input.kind, reason: input.reason, byId: actor.id },
      update: { reason: input.reason, byId: actor.id, at: new Date() },
    });
    await audit(tx, actor, { action: "conflict.keep", entity: "Shift", entityId: shiftId, locationId: s.locationId, after: input });
  });
}

/** Approves a person's overtime for a week at the hours scheduled now. More hours later need a new approval. */
export async function approveOvertime(actor: Actor, userId: string, weekStart: string, note?: string) {
  const org = await db.organization.findFirstOrThrow();
  // Any store's week works for the range; the actor must manage a store where this person works that week.
  const shifts = await db.shift.findMany({
    where: { userId, startsAt: { gte: new Date(`${addDays(weekStart, -1)}T00:00:00Z`), lt: new Date(`${addDays(weekStart, 8)}T00:00:00Z`) } },
    include: { location: { select: { timezone: true } } },
  });
  const inWeek = shifts.filter((s) => weekStartOf(localDateOf(s.startsAt, s.location.timezone), org.weekStartsOn) === weekStart);
  if (!inWeek.some((s) => canManageLocation(actor, s.locationId))) throw new ForbiddenError();
  const { weeks } = costShifts(inWeek, {
    ...org, tzOf: (id) => inWeek.find((s) => s.locationId === id)!.location.timezone, ratesOf: () => [],
  });
  const minutes = weeks[0]?.scheduledMinutes ?? 0;
  if (minutes <= org.overtimeThresholdMinutes) throw new UserError("They're not over the overtime limit that week.");
  await db.$transaction(async (tx) => {
    await tx.overtimeApproval.upsert({
      where: { userId_weekStart: { userId, weekStart: toDbDate(weekStart) } },
      create: { userId, weekStart: toDbDate(weekStart), approvedMinutes: minutes, approvedById: actor.id, note },
      update: { approvedMinutes: minutes, approvedById: actor.id, note, createdAt: new Date() },
    });
    await audit(tx, actor, { action: "overtime.approve", entity: "User", entityId: userId, after: { weekStart, minutes } });
  });
  return { minutes };
}

export async function publishWeek(actor: Actor, locationId: string, weekStart: string) {
  const loc = await loadLocation(actor, locationId);
  const board = await getBoard(actor, locationId, weekStart);
  if (!board.shifts.length) throw new UserError("Add shifts before publishing.");
  if (board.blockers.conflicts > 0) throw new UserError("Fix the double-bookings before publishing.");
  if (board.blockers.overtime.length > 0) throw new UserError("Approve or remove the overtime before publishing.");
  const recipients = [...new Set(board.shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
  await db.$transaction(async (tx) => {
    const week = await tx.scheduleWeek.upsert({
      where: { locationId_weekStart: { locationId, weekStart: toDbDate(board.weekStart) } },
      create: { locationId, weekStart: toDbDate(board.weekStart), status: "PUBLISHED", publishedAt: new Date(), publishedById: actor.id },
      update: { status: "PUBLISHED", publishedAt: new Date(), publishedById: actor.id },
    });
    await notify(tx, recipients, {
      type: "schedule.published", title: `${loc.name}: week of ${board.weekStart} is out`,
      body: "Your shifts for the week are ready.", href: "/my-shifts",
    });
    await audit(tx, actor, { action: "week.publish", entity: "ScheduleWeek", entityId: week.id, locationId, after: { weekStart: board.weekStart, recipients: recipients.length } });
  });
  return { notified: recipients.length };
}

/**
 * Copies last week's shifts into this week at the same wall-clock times. Anyone who can't take
 * their copy any more (deactivated, already booked, on approved time off) leaves it as an open
 * shift instead, so nothing is silently dropped.
 */
export async function copyLastWeek(actor: Actor, locationId: string, weekStart: string) {
  const loc = await loadLocation(actor, locationId);
  const tz = loc.timezone;
  const prev = weekInterval(addDays(weekStart, -7), tz);
  const source = await db.shift.findMany({ where: { locationId, startsAt: { gte: prev.start, lt: prev.end } }, include: { user: { select: { status: true } } } });
  if (!source.length) throw new UserError("Last week has no shifts to copy.");
  const existing = await db.shift.count({ where: { locationId, startsAt: { gte: weekInterval(weekStart, tz).start, lt: weekInterval(weekStart, tz).end } } });
  if (existing) throw new UserError("This week already has shifts. Copy only works on an empty week.");
  let assigned = 0;
  let opened = 0;
  await db.$transaction(async (tx) => {
    const week = await weekFor(tx, locationId, weekStart);
    for (const s of source) {
      const day = addDays(localDateOf(s.startsAt, tz), 7);
      const startMin = localMinuteOf(s.startsAt, tz);
      const length = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
      const startsAt = atLocal(day, startMin, tz);
      const endsAt = atLocal(day, startMin + length, tz);
      let userId = s.user?.status === "DEACTIVATED" ? null : s.userId;
      if (userId) {
        const clash = await tx.shift.findFirst({ where: { userId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
        const off = await tx.timeOffRequest.findFirst({ where: { userId, status: "APPROVED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
        if (clash || off) userId = null;
      }
      await tx.shift.create({
        data: { scheduleWeekId: week.id, locationId, userId, positionId: s.positionId, startsAt, endsAt, breakMinutes: s.breakMinutes, notes: s.notes },
      });
      if (userId) assigned++;
      else opened++;
    }
    await audit(tx, actor, { action: "week.copy", entity: "ScheduleWeek", entityId: week.id, locationId, after: { weekStart, assigned, opened } });
  });
  return { assigned, opened };
}
