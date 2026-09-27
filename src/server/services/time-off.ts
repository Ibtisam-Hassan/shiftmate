import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, atLocal, localDateOf } from "@/domain/time";
import { audit, notify } from "@/server/audit";
import { type Actor, ForbiddenError, canManageEmployee, managedLocationIds } from "@/server/authz/policy";
import { UserError } from "@/server/errors";
import { approversFor, homeTimezone } from "./home";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const requestInput = z.object({
  from: date,
  to: date,
  reason: z.string().trim().max(200).optional().or(z.literal("")),
}).refine((r) => r.to >= r.from, { message: "The last day must be on or after the first day", path: ["to"] });

/** Whole days off, from the first day's midnight to the midnight after the last day, at home. */
export async function requestTimeOff(actor: Actor, raw: z.input<typeof requestInput>) {
  const input = requestInput.parse(raw);
  const tz = await homeTimezone(actor.id);
  if (input.from < localDateOf(new Date(), tz)) throw new UserError("Time off can't start in the past.", { from: "In the past" });
  const startsAt = atLocal(input.from, 0, tz);
  const endsAt = atLocal(addDays(input.to, 1), 0, tz);
  const clash = await db.timeOffRequest.findFirst({
    where: { userId: actor.id, status: { in: ["PENDING", "APPROVED"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  if (clash) throw new UserError("You already asked for time off on some of these days.");
  await db.$transaction(async (tx) => {
    const req = await tx.timeOffRequest.create({ data: { userId: actor.id, startsAt, endsAt, reason: input.reason || null } });
    await audit(tx, actor, { action: "time_off.request", entity: "TimeOffRequest", entityId: req.id, after: input });
    await notify(tx, await approversFor(actor.id), {
      type: "time_off.requested", title: `${actor.name} asked for time off`, body: `${input.from} to ${input.to}`, href: "/requests",
    });
  });
}

export async function cancelTimeOff(actor: Actor, id: string) {
  const req = await db.timeOffRequest.findUnique({ where: { id } });
  if (!req || req.userId !== actor.id) throw new ForbiddenError();
  if (req.status === "DENIED" || req.status === "CANCELLED") throw new UserError("That request is already closed.");
  if (req.startsAt <= new Date()) throw new UserError("That time off has started, so it can't be cancelled here. Ask your manager.");
  await db.$transaction(async (tx) => {
    await tx.timeOffRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    await audit(tx, actor, { action: "time_off.cancel", entity: "TimeOffRequest", entityId: id });
  });
}

async function loadForReview(actor: Actor, id: string) {
  const req = await db.timeOffRequest.findUnique({ where: { id }, include: { user: { include: { locations: true } } } });
  if (!req) throw new UserError("That request no longer exists.");
  const target = { id: req.userId, role: req.user.role, locationIds: req.user.locations.map((l) => l.locationId) };
  if (!canManageEmployee(actor, target)) throw new ForbiddenError();
  if (req.status !== "PENDING") throw new UserError("Someone already decided this request.");
  return req;
}

/** Approving can also turn the person's shifts in that period into open shifts. */
export async function decideTimeOff(actor: Actor, id: string, decision: { approve: boolean; note?: string; openShifts?: boolean }) {
  const req = await loadForReview(actor, id);
  const scope = managedLocationIds(actor);
  await db.$transaction(async (tx) => {
    await tx.timeOffRequest.update({
      where: { id },
      data: { status: decision.approve ? "APPROVED" : "DENIED", reviewedById: actor.id, reviewedAt: new Date(), reviewNote: decision.note || null },
    });
    let opened = 0;
    if (decision.approve && decision.openShifts) {
      const overlap = { userId: req.userId, startsAt: { lt: req.endsAt }, endsAt: { gt: req.startsAt } };
      ({ count: opened } = await tx.shift.updateMany({
        where: scope ? { ...overlap, locationId: { in: scope } } : overlap,
        data: { userId: null },
      }));
    }
    await audit(tx, actor, { action: decision.approve ? "time_off.approve" : "time_off.deny", entity: "TimeOffRequest", entityId: id, after: { ...decision, opened } });
    await notify(tx, [req.userId], {
      type: "time_off.decided", title: `Your time off was ${decision.approve ? "approved" : "denied"}`,
      body: decision.note || undefined, href: "/requests",
    });
  });
}
