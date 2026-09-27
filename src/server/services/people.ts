import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { localDateOf, toDbDate } from "@/domain/time";
import { audit } from "@/server/audit";
import {
  type Actor, ForbiddenError, assertAdmin, canManageEmployee,
} from "@/server/authz/policy";
import { UserError } from "@/server/errors";
import { PROTECTED_DEMO_EMAILS, loadTarget } from "./people-shared";


export const personInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  locationIds: z.array(z.string()).default([]),
  homeLocationId: z.string().optional().nullable(),
  managedLocationId: z.string().optional().nullable(),
  hourlyRate: z.coerce.number().min(7.25, "At least $7.25/h").max(250).optional(),
});
export type PersonInput = z.input<typeof personInput>;

function checkShape(input: z.infer<typeof personInput>) {
  if (input.role === "MANAGER" && !input.managedLocationId) {
    throw new UserError("Pick the store this manager runs.", { managedLocationId: "Required for managers" });
  }
  if (input.role === "EMPLOYEE" && input.locationIds.length === 0) {
    throw new UserError("Pick at least one store.", { locationIds: "Pick at least one store" });
  }
  if (input.homeLocationId && !input.locationIds.includes(input.homeLocationId)) {
    throw new UserError("The home store must be one of their stores.", { homeLocationId: "Not one of their stores" });
  }
}

export async function createPerson(actor: Actor, raw: PersonInput) {
  const input = personInput.parse(raw);
  if (actor.role === "MANAGER") {
    // Managers add staff to their own store only.
    if (input.role !== "EMPLOYEE") throw new ForbiddenError("Managers can only add employees.");
    input.locationIds = [actor.managedLocationId!];
    input.homeLocationId = actor.managedLocationId;
    input.managedLocationId = null;
  } else {
    assertAdmin(actor);
  }
  checkShape(input);
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new UserError("Someone already uses that email.", { email: "Already in use" });
  }
  const id = randomUUID();
  const today = localDateOf(new Date(), "America/Chicago");
  const home = input.homeLocationId ?? input.locationIds[0];
  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id, name: input.name, email: input.email, phone: input.phone || null, role: input.role, status: "INVITED",
        locations: { create: input.locationIds.map((locationId) => ({ locationId, isHome: locationId === home })) },
        managerOf: input.role === "MANAGER" ? { create: { locationId: input.managedLocationId! } } : undefined,
        payRates: input.hourlyRate
          ? { create: { hourlyRateCents: Math.round(input.hourlyRate * 100), effectiveFrom: toDbDate(today) } }
          : undefined,
      },
    });
    await audit(tx, actor, { action: "person.create", entity: "User", entityId: id, locationId: home, after: input });
  });
  return { id };
}


export async function updatePerson(actor: Actor, id: string, raw: PersonInput) {
  const input = personInput.parse(raw);
  const target = await loadTarget(id);
  const targetScope = { id, role: target.role, locationIds: target.locations.map((l) => l.locationId) };
  if (!canManageEmployee(actor, targetScope)) throw new ForbiddenError();
  if (id === actor.id && input.role !== actor.role) throw new UserError("You can't change your own role.");

  if (actor.role === "MANAGER") {
    // Store memberships and roles are admin decisions; a manager edits the profile only.
    input.role = "EMPLOYEE";
    input.locationIds = targetScope.locationIds;
    input.homeLocationId = target.locations.find((l) => l.isHome)?.locationId ?? null;
    input.managedLocationId = null;
  }
  if (PROTECTED_DEMO_EMAILS.has(target.email) && (input.email !== target.email || input.role !== target.role)) {
    throw new UserError("The demo logins' email and role are locked so the demo keeps working for everyone.");
  }
  checkShape(input);
  const clash = await db.user.findUnique({ where: { email: input.email } });
  if (clash && clash.id !== id) throw new UserError("Someone already uses that email.", { email: "Already in use" });

  const home = input.homeLocationId ?? input.locationIds[0] ?? null;
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { name: input.name, email: input.email, phone: input.phone || null, role: input.role },
    });
    if (actor.role === "ADMIN") {
      await tx.employeeLocation.deleteMany({ where: { userId: id, locationId: { notIn: input.locationIds } } });
      for (const locationId of input.locationIds) {
        await tx.employeeLocation.upsert({
          where: { userId_locationId: { userId: id, locationId } },
          create: { userId: id, locationId, isHome: locationId === home },
          update: { isHome: locationId === home },
        });
      }
      if (input.role === "MANAGER") {
        await tx.managerAssignment.upsert({
          where: { userId: id },
          create: { userId: id, locationId: input.managedLocationId! },
          update: { locationId: input.managedLocationId! },
        });
      } else {
        await tx.managerAssignment.deleteMany({ where: { userId: id } });
      }
    }
    await audit(tx, actor, {
      action: "person.update", entity: "User", entityId: id, locationId: home,
      before: { name: target.name, email: target.email, role: target.role, locationIds: targetScope.locationIds },
      after: input,
    });
  });
}


export type { TeamMember } from "./people-list";
export { listTeam } from "./people-list";
export { addPayRate, payRateInput, setPersonStatus } from "./people-status";
