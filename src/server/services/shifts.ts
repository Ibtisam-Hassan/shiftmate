import "server-only";
import { db } from "@/lib/db";
import { localMinuteOf } from "@/domain/time";
import { audit } from "@/server/audit";
import type { Actor } from "@/server/authz/policy";
import { UserError } from "@/server/errors";
import {
  type ShiftInput, checkAssignee, checkPosition, describe, loadLocation, loadShift, save, shiftInput, span, tellIfPublished, weekFor,
} from "./shift-rules";

export type { ShiftInput } from "./shift-rules";

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
