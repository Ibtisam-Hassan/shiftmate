import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { atLocal, toDbDate, weekStartOf } from "@/domain/time";
import { notify } from "@/server/audit";
import { type Actor, ForbiddenError, assertCanManageLocation, canManageLocation } from "@/server/authz/policy";
import { UserError, isOverlapViolation } from "@/server/errors";

/** Shared checks and helpers for the shift, week and approval services. */

export type Tx = Prisma.TransactionClient;

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
export function span(date: string, start: string, end: string, tz: string) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return { startsAt: atLocal(date, s, tz), endsAt: atLocal(date, e, tz), minutes: e - s };
}

export async function loadLocation(actor: Actor, locationId: string) {
  assertCanManageLocation(actor, locationId);
  const loc = await db.location.findUnique({ where: { id: locationId } });
  if (!loc) throw new UserError("That store no longer exists.");
  return loc;
}

export async function weekFor(tx: Tx, locationId: string, date: string) {
  const org = await tx.organization.findFirstOrThrow();
  const weekStart = weekStartOf(date, org.weekStartsOn);
  return tx.scheduleWeek.upsert({
    where: { locationId_weekStart: { locationId, weekStart: toDbDate(weekStart) } },
    create: { locationId, weekStart: toDbDate(weekStart) },
    update: {},
  });
}

export async function checkAssignee(tx: Tx, userId: string | null | undefined) {
  if (!userId) return;
  const u = await tx.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
  if (!u || u.status === "DEACTIVATED") throw new UserError("That person can't be scheduled.");
}

export async function checkPosition(tx: Tx, locationId: string, positionId: string | null | undefined) {
  if (!positionId) return;
  const p = await tx.position.findFirst({ where: { id: positionId, locationId } });
  if (!p) throw new UserError("Pick a position from this store.");
}

/** Published weeks change in place; the people affected hear about it in the app. */
export async function tellIfPublished(tx: Tx, weekId: string, userIds: (string | null | undefined)[], title: string, locationName: string) {
  const week = await tx.scheduleWeek.findUnique({ where: { id: weekId } });
  if (week?.status !== "PUBLISHED") return;
  await notify(tx, userIds.filter((u): u is string => !!u), { type: "schedule.changed", title, body: `${locationName} schedule updated.`, href: "/my-shifts" });
}

export function describe(startsAt: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(startsAt);
}

export async function save<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isOverlapViolation(e)) throw new UserError("That person already has a shift at that time.");
    throw e;
  }
}


export async function loadShift(actor: Actor, id: string) {
  const shift = await db.shift.findUnique({ where: { id }, include: { location: true } });
  if (!shift) throw new UserError("That shift no longer exists.");
  if (!canManageLocation(actor, shift.locationId)) throw new ForbiddenError();
  return shift;
}
