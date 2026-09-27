import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { toDbDate } from "@/domain/time";
import { audit } from "@/server/audit";
import { type Actor, ForbiddenError, canManageEmployee } from "@/server/authz/policy";
import { UserError } from "@/server/errors";
import { PROTECTED_DEMO_EMAILS, loadTarget } from "./people-shared";

export async function setPersonStatus(actor: Actor, id: string, status: "ACTIVE" | "DEACTIVATED") {
  const target = await loadTarget(id);
  if (!canManageEmployee(actor, { id, role: target.role, locationIds: target.locations.map((l) => l.locationId) })) {
    throw new ForbiddenError();
  }
  if (id === actor.id) throw new UserError("You can't deactivate yourself.");
  if (PROTECTED_DEMO_EMAILS.has(target.email)) throw new UserError("The demo logins can't be deactivated.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status } });
    if (status === "DEACTIVATED") {
      await tx.session.deleteMany({ where: { userId: id } });
      // Their future shifts become open shifts so nobody is silently left unstaffed.
      await tx.shift.updateMany({ where: { userId: id, startsAt: { gt: new Date() } }, data: { userId: null } });
    }
    await audit(tx, actor, { action: `person.${status.toLowerCase()}`, entity: "User", entityId: id, before: { status: target.status }, after: { status } });
  });
}

export const payRateInput = z.object({
  hourlyRate: z.coerce.number().min(7.25, "At least $7.25/h").max(250),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export async function addPayRate(actor: Actor, id: string, raw: z.input<typeof payRateInput>) {
  const input = payRateInput.parse(raw);
  const target = await loadTarget(id);
  if (!canManageEmployee(actor, { id, role: target.role, locationIds: target.locations.map((l) => l.locationId) })) {
    throw new ForbiddenError();
  }
  const cents = Math.round(input.hourlyRate * 100);
  await db.$transaction(async (tx) => {
    await tx.payRate.upsert({
      where: { userId_effectiveFrom: { userId: id, effectiveFrom: toDbDate(input.effectiveFrom) } },
      create: { userId: id, hourlyRateCents: cents, effectiveFrom: toDbDate(input.effectiveFrom) },
      update: { hourlyRateCents: cents },
    });
    await audit(tx, actor, { action: "pay_rate.set", entity: "User", entityId: id, after: input });
  });
}
