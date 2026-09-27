import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit, notify } from "@/server/audit";
import { type Actor, ForbiddenError, canManageLocation } from "@/server/authz/policy";
import { UserError, isOverlapViolation } from "@/server/errors";
import { approversFor } from "./home";
import { swapProblems } from "./swap-check";

type Tx = Prisma.TransactionClient;

export const swapInput = z.object({
  shiftId: z.string(),
  targetUserId: z.string(),
  targetShiftId: z.string().nullable().optional(),
  message: z.string().trim().max(200).optional().or(z.literal("")),
});

async function publishedFuture(shiftId: string) {
  const s = await db.shift.findUnique({ where: { id: shiftId }, include: { scheduleWeek: true, location: true } });
  if (!s || s.scheduleWeek.status !== "PUBLISHED" || s.startsAt <= new Date()) {
    throw new UserError("You can only swap upcoming shifts from a published week.");
  }
  return s;
}

/** Employee A offers their shift to coworker B, as a cover or in exchange for one of B's shifts. */
export async function requestSwap(actor: Actor, raw: z.input<typeof swapInput>) {
  const input = swapInput.parse(raw);
  const shift = await publishedFuture(input.shiftId);
  if (shift.userId !== actor.id) throw new ForbiddenError("You can only offer your own shifts.");
  if (input.targetUserId === actor.id) throw new UserError("Pick a coworker.");
  const works = await db.employeeLocation.findFirst({ where: { userId: input.targetUserId, locationId: shift.locationId, user: { status: "ACTIVE" } } });
  if (!works) throw new UserError("That coworker doesn't work at this store.");
  if (input.targetShiftId) {
    const theirs = await publishedFuture(input.targetShiftId);
    if (theirs.userId !== input.targetUserId || theirs.locationId !== shift.locationId) throw new UserError("Pick one of their shifts at this store.");
  }
  const open = await db.swapRequest.findFirst({ where: { shiftId: shift.id, status: { in: ["PENDING_COWORKER", "PENDING_MANAGER"] } } });
  if (open) throw new UserError("This shift already has a swap request waiting.");
  await db.$transaction(async (tx) => {
    const req = await tx.swapRequest.create({
      data: { shiftId: shift.id, requesterId: actor.id, targetUserId: input.targetUserId, targetShiftId: input.targetShiftId ?? null, message: input.message || null },
    });
    await audit(tx, actor, { action: "swap.request", entity: "SwapRequest", entityId: req.id, locationId: shift.locationId, after: input });
    await notify(tx, [input.targetUserId], {
      type: "swap.requested", title: `${actor.name} asked you to ${input.targetShiftId ? "trade shifts" : "cover a shift"}`,
      body: input.message || undefined, href: "/my-shifts",
    });
  });
}

type Req = { shiftId: string; targetShiftId: string | null; requesterId: string; targetUserId: string };

/** Moves the shifts. A shift is emptied first so a trade never holds two overlapping shifts at once. */
async function apply(tx: Tx, req: Req) {
  // The schedule may have changed since the request was made.
  const mine = await tx.shift.findUnique({ where: { id: req.shiftId } });
  const theirs = req.targetShiftId ? await tx.shift.findUnique({ where: { id: req.targetShiftId } }) : null;
  if (mine?.userId !== req.requesterId || (req.targetShiftId && theirs?.userId !== req.targetUserId)) {
    throw new UserError("The shifts changed since this request was made, so it can't go ahead.");
  }
  await tx.shift.update({ where: { id: req.shiftId }, data: { userId: null } });
  if (req.targetShiftId) await tx.shift.update({ where: { id: req.targetShiftId }, data: { userId: req.requesterId } });
  await tx.shift.update({ where: { id: req.shiftId }, data: { userId: req.targetUserId } });
  await tx.conflictOverride.deleteMany({ where: { shiftId: { in: [req.shiftId, req.targetShiftId ?? ""] } } });
}

function moves(req: Req) {
  const list = [{ shiftId: req.shiftId, toUserId: req.targetUserId }];
  if (req.targetShiftId) list.push({ shiftId: req.targetShiftId, toUserId: req.requesterId });
  return list;
}

/** Coworker B answers. A clean swap applies now; anything else goes to a manager. */
export async function respondSwap(actor: Actor, id: string, accept: boolean) {
  const req = await db.swapRequest.findUnique({ where: { id }, include: { shift: true } });
  if (!req || req.targetUserId !== actor.id) throw new ForbiddenError();
  if (req.status !== "PENDING_COWORKER") throw new UserError("This request is already closed.");
  if (!accept) {
    await db.$transaction(async (tx) => {
      await tx.swapRequest.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
      await audit(tx, actor, { action: "swap.decline", entity: "SwapRequest", entityId: id, locationId: req.shift.locationId });
      await notify(tx, [req.requesterId], { type: "swap.declined", title: `${actor.name} said no to your swap`, href: "/my-shifts" });
    });
    return { status: "REJECTED" as const, problems: [] as string[] };
  }
  const problems = await swapProblems(moves(req));
  const status = problems.length ? "PENDING_MANAGER" : "APPROVED";
  await db.$transaction(async (tx) => {
    if (!problems.length) await apply(tx, req);
    await tx.swapRequest.update({ where: { id }, data: { status, decidedAt: problems.length ? null : new Date(), escalationReason: problems.join(" ") || null } });
    await audit(tx, actor, { action: "swap.accept", entity: "SwapRequest", entityId: id, locationId: req.shift.locationId, after: { status, problems } });
    if (problems.length) {
      await notify(tx, await approversFor(req.requesterId), { type: "swap.needs_manager", title: "A shift swap needs your approval", body: problems.join(" "), href: "/requests" });
      await notify(tx, [req.requesterId], { type: "swap.accepted", title: `${actor.name} accepted. A manager must approve it.`, href: "/my-shifts" });
    } else {
      await notify(tx, [req.requesterId], { type: "swap.done", title: `${actor.name} accepted your swap. It is done.`, href: "/my-shifts" });
    }
  });
  return { status, problems };
}

export async function decideSwap(actor: Actor, id: string, approve: boolean) {
  const req = await db.swapRequest.findUnique({ where: { id }, include: { shift: true } });
  if (!req || !canManageLocation(actor, req.shift.locationId)) throw new ForbiddenError();
  if (req.status !== "PENDING_MANAGER") throw new UserError("This request isn't waiting for a manager.");
  await db.$transaction(async (tx) => {
    if (approve) {
      await apply(tx, req).catch((e) => {
        throw isOverlapViolation(e) ? new UserError("This swap would put someone on two shifts at once.") : e;
      });
    }
    await tx.swapRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", decidedById: actor.id, decidedAt: new Date() } });
    await audit(tx, actor, { action: approve ? "swap.approve" : "swap.reject", entity: "SwapRequest", entityId: id, locationId: req.shift.locationId });
    await notify(tx, [req.requesterId, req.targetUserId], { type: "swap.decided", title: `Your shift swap was ${approve ? "approved" : "not approved"}`, href: "/my-shifts" });
  });
}

export async function cancelSwap(actor: Actor, id: string) {
  const req = await db.swapRequest.findUnique({ where: { id } });
  if (!req || req.requesterId !== actor.id) throw new ForbiddenError();
  if (req.status !== "PENDING_COWORKER" && req.status !== "PENDING_MANAGER") throw new UserError("This request is already closed.");
  await db.$transaction(async (tx) => {
    await tx.swapRequest.update({ where: { id }, data: { status: "CANCELLED", decidedAt: new Date() } });
    await audit(tx, actor, { action: "swap.cancel", entity: "SwapRequest", entityId: id });
  });
}
