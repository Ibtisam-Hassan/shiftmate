"use server";

import { revalidatePath } from "next/cache";
import { rankCandidates } from "@/domain/assign";
import { atLocal, localDateOf } from "@/domain/time";
import { db } from "@/lib/db";
import { requireActor } from "@/server/authz/actor";
import { canManageLocation } from "@/server/authz/policy";
import { run, UserError } from "@/server/errors";
import { getBoard } from "@/server/services/board";
import {
  type ShiftInput, approveOvertime, assignShift, copyLastWeek, createShift, deleteShift, keepAnyway, makeOpen, moveShift,
  publishWeek, updateShift,
} from "@/server/services/shifts";

async function act<T>(fn: (a: Awaited<ReturnType<typeof requireActor>>) => Promise<T>) {
  const actor = await requireActor();
  const res = await run(() => fn(actor));
  if (res.ok) revalidatePath("/schedule");
  return res;
}

export const createShiftAction = async (locationId: string, input: ShiftInput) => act((a) => createShift(a, locationId, input));
export const updateShiftAction = async (id: string, input: ShiftInput) => act((a) => updateShift(a, id, input));
export const moveShiftAction = async (id: string, target: { date: string; userId: string | null }) => act((a) => moveShift(a, id, target));
export const deleteShiftAction = async (id: string) => act((a) => deleteShift(a, id));
export const makeOpenAction = async (id: string) => act((a) => makeOpen(a, id));
export const assignShiftAction = async (id: string, userId: string) => act((a) => assignShift(a, id, userId));
export const keepAnywayAction = async (id: string, kind: string, reason: string) =>
  act((a) => keepAnyway(a, id, { kind: kind as never, reason }));
export const approveOvertimeAction = async (userId: string, weekStart: string) => act((a) => approveOvertime(a, userId, weekStart));
export const publishWeekAction = async (locationId: string, weekStart: string) => act((a) => publishWeek(a, locationId, weekStart));
export const copyLastWeekAction = async (locationId: string, weekStart: string) => act((a) => copyLastWeek(a, locationId, weekStart));

/** Ranked people for a shift (the Assign / Reassign panel). Read-only, so no revalidation. */
export async function candidatesAction(shiftId: string) {
  const actor = await requireActor();
  return run(async () => {
    const shift = await db.shift.findUnique({ where: { id: shiftId }, include: { location: true } });
    if (!shift || !canManageLocation(actor, shift.locationId)) throw new UserError("That shift is gone.");
    const tz = shift.location.timezone;
    const board = await getBoard(actor, shift.locationId, localDateOf(shift.startsAt, tz));
    const me = board.shifts.find((s) => s.id === shiftId)!;
    const people = board.people.filter((p) => p.isMember && p.id !== shift.userId).map((p) => {
      const here = board.shifts.filter((s) => s.userId === p.id && s.id !== shiftId)
        .map((s) => ({ startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt), localDate: s.day, label: `here ${s.day}` }));
      // Other stores' bookings arrive as local minutes; turn them back into instants.
      const away = board.elsewhere.filter((e) => e.userId === p.id)
        .map((e) => ({ startsAt: atLocal(e.day, e.startMin, tz), endsAt: atLocal(e.day, e.endMin, tz), localDate: e.day, label: e.label }));
      const unavailable = board.unavailable.find((u) => u.userId === p.id && u.day === me.day && u.startMin < me.endMin && me.startMin < u.endMin);
      return {
        userId: p.id, name: p.name, weekMinutes: p.weekMinutes, rateCents: p.rateCents,
        shifts: [...here, ...away],
        unavailableReason: unavailable ? unavailable.label : null,
        onTimeOff: board.timeOff.some((t) => t.userId === p.id && t.day === me.day),
      };
    });
    return rankCandidates(
      { startsAt: new Date(me.startsAt), endsAt: new Date(me.endsAt), paidMinutes: me.paidMinutes, localDate: me.day },
      people, board.rules,
    );
  });
}
