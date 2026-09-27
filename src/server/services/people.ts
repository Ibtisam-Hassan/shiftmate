import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_LOGINS } from "@/lib/demo";
import { rateOn } from "@/domain/pay";
import { fromDbDate, localDateOf, toDbDate } from "@/domain/time";
import { audit } from "@/server/audit";
import {
  type Actor, ForbiddenError, assertAdmin, canManageEmployee, managedLocationIds,
} from "@/server/authz/policy";
import { UserError } from "@/server/errors";

const PROTECTED_DEMO_EMAILS = new Set<string>(DEMO_LOGINS.map((d) => d.email));

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

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  status: "INVITED" | "ACTIVE" | "DEACTIVATED";
  isDemo: boolean;
  locations: { id: string; name: string; isHome: boolean }[];
  managedLocation: { id: string; name: string } | null;
  hourlyRateCents: number | null;
  rates: { hourlyRateCents: number; effectiveFrom: string }[];
  canEdit: boolean;
}

export async function listTeam(actor: Actor, filter: { locationId?: string } = {}): Promise<TeamMember[]> {
  const scope = managedLocationIds(actor);
  if (scope && scope.length === 0) throw new ForbiddenError();
  const locationFilter = filter.locationId
    ? scope && !scope.includes(filter.locationId) ? scope : [filter.locationId]
    : scope;
  const users = await db.user.findMany({
    where: locationFilter
      ? {
          OR: [
            { locations: { some: { locationId: { in: locationFilter } } } },
            { managerOf: { locationId: { in: locationFilter } } },
          ],
        }
      : {},
    include: {
      locations: { include: { location: { select: { id: true, name: true } } } },
      managerOf: { include: { location: { select: { id: true, name: true } } } },
      payRates: { orderBy: { effectiveFrom: "desc" } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  const today = localDateOf(new Date(), "America/Chicago");
  return users.map((u) => {
    const rates = u.payRates.map((r) => ({ hourlyRateCents: r.hourlyRateCents, effectiveFrom: fromDbDate(r.effectiveFrom) }));
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, isDemo: u.isDemo,
      locations: u.locations.map((l) => ({ id: l.location.id, name: l.location.name, isHome: l.isHome }))
        .sort((a, b) => Number(b.isHome) - Number(a.isHome)),
      managedLocation: u.managerOf?.location ?? null,
      hourlyRateCents: rateOn(rates, today),
      rates,
      canEdit: canManageEmployee(actor, { id: u.id, role: u.role, locationIds: u.locations.map((l) => l.locationId) }),
    };
  });
}

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

async function loadTarget(id: string) {
  const u = await db.user.findUnique({ where: { id }, include: { locations: true, managerOf: true } });
  if (!u) throw new UserError("That person no longer exists.");
  return u;
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
