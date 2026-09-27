import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { costShifts } from "@/domain/labor";
import { addDays, localDateOf, toDbDate, weekStartOf } from "@/domain/time";
import { audit } from "@/server/audit";
import { type Actor, ForbiddenError, canManageLocation } from "@/server/authz/policy";
import { UserError } from "@/server/errors";
import { loadShift } from "./shift-rules";

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
