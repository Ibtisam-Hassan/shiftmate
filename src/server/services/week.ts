import "server-only";
import { db } from "@/lib/db";
import { addDays, atLocal, localDateOf, localMinuteOf, toDbDate, weekInterval } from "@/domain/time";
import { audit, notify } from "@/server/audit";
import type { Actor } from "@/server/authz/policy";
import { UserError } from "@/server/errors";
import { getBoard } from "./board";
import { loadLocation, weekFor } from "./shift-rules";

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
  const next = weekInterval(weekStart, tz);
  const source = await db.shift.findMany({
    where: { locationId, startsAt: { gte: prev.start, lt: prev.end } },
    include: { user: { select: { status: true } } },
  });
  if (!source.length) throw new UserError("Last week has no shifts to copy.");
  if (await db.shift.count({ where: { locationId, startsAt: { gte: next.start, lt: next.end } } })) {
    throw new UserError("This week already has shifts. Copy only works on an empty week.");
  }

  // Same wall-clock times one week later (atLocal keeps them right across DST changes).
  const copies = source.map((s) => {
    const startMin = localMinuteOf(s.startsAt, tz);
    const day = addDays(localDateOf(s.startsAt, tz), 7);
    const length = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
    const userId = s.user?.status === "DEACTIVATED" ? null : s.userId;
    return { ...s, userId, startsAt: atLocal(day, startMin, tz), endsAt: atLocal(day, startMin + length, tz) };
  });

  // Load every possible clash in two queries instead of two per shift: this runs on a remote DB.
  const people = [...new Set(copies.flatMap((c) => (c.userId ? [c.userId] : [])))];
  const window = { startsAt: { lt: next.end }, endsAt: { gt: next.start } };
  const busy = await db.shift.findMany({ where: { userId: { in: people }, ...window }, select: { userId: true, startsAt: true, endsAt: true } });
  const off = await db.timeOffRequest.findMany({ where: { userId: { in: people }, status: "APPROVED", ...window } });
  const clashes = (c: (typeof copies)[number]) =>
    [...busy, ...off].some((b) => b.userId === c.userId && b.startsAt < c.endsAt && c.startsAt < b.endsAt);

  const rows = copies.map((c) => ({ ...c, userId: c.userId && !clashes(c) ? c.userId : null }));
  const assigned = rows.filter((r) => r.userId).length;
  const opened = rows.length - assigned;
  await db.$transaction(async (tx) => {
    const week = await weekFor(tx, locationId, weekStart);
    await tx.shift.createMany({
      data: rows.map((r) => ({
        scheduleWeekId: week.id, locationId, userId: r.userId, positionId: r.positionId,
        startsAt: r.startsAt, endsAt: r.endsAt, breakMinutes: r.breakMinutes, notes: r.notes,
      })),
    });
    await audit(tx, actor, { action: "week.copy", entity: "ScheduleWeek", entityId: week.id, locationId, after: { weekStart, assigned, opened } });
  });
  return { assigned, opened };
}
