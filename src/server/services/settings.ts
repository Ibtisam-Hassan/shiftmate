import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { type Actor, assertAdmin, assertCanManageLocation } from "@/server/authz/policy";
import { UserError } from "@/server/errors";

export const orgRulesInput = z.object({
  overtimeThresholdHours: z.coerce.number().min(20).max(80),
  overtimeMultiplier: z.coerce.number().min(1).max(3),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
  minRestHours: z.coerce.number().min(0).max(24),
});

export async function getOrg() {
  return db.organization.findFirstOrThrow();
}

export async function updateOrgRules(actor: Actor, raw: z.input<typeof orgRulesInput>) {
  assertAdmin(actor);
  const input = orgRulesInput.parse(raw);
  const org = await getOrg();
  const data = {
    overtimeThresholdMinutes: Math.round(input.overtimeThresholdHours * 60),
    overtimeMultiplierPercent: Math.round(input.overtimeMultiplier * 100),
    weekStartsOn: input.weekStartsOn,
    minRestMinutes: Math.round(input.minRestHours * 60),
  };
  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: org.id }, data });
    await audit(tx, actor, { action: "org.rules", entity: "Organization", entityId: org.id, before: org, after: data });
  });
}

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

export const locationInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  timezone: z.string().refine((tz) => TIMEZONES.has(tz), "Pick a valid time zone"),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  weeklyBudget: z.union([z.literal(""), z.coerce.number().min(0).max(1_000_000)]).optional(),
});

export async function saveLocation(actor: Actor, id: string | null, raw: z.input<typeof locationInput>) {
  assertAdmin(actor);
  const input = locationInput.parse(raw);
  const org = await getOrg();
  const data = {
    name: input.name,
    timezone: input.timezone,
    address: input.address || null,
    weeklyBudgetCents: input.weeklyBudget === "" || input.weeklyBudget === undefined ? null : Math.round(input.weeklyBudget * 100),
  };
  if (id) {
    const before = await db.location.findUniqueOrThrow({ where: { id } });
    if (before.timezone !== data.timezone && (await db.shift.count({ where: { locationId: id } })) > 0) {
      // Stored shifts are instants; changing the zone would silently move every shift's wall-clock time.
      throw new UserError("This store already has shifts, so its time zone can't change.", { timezone: "Locked: store has shifts" });
    }
    await db.$transaction(async (tx) => {
      await tx.location.update({ where: { id }, data });
      await audit(tx, actor, { action: "location.update", entity: "Location", entityId: id, locationId: id, before, after: data });
    });
    return { id };
  }
  const created = await db.$transaction(async (tx) => {
    const loc = await tx.location.create({ data: { ...data, orgId: org.id } });
    await tx.position.createMany({
      data: [
        { locationId: loc.id, name: "Cashier", color: "cashier" },
        { locationId: loc.id, name: "Stock", color: "stock" },
        { locationId: loc.id, name: "Floor", color: "floor" },
        { locationId: loc.id, name: "Supervisor", color: "supervisor" },
      ],
    });
    await audit(tx, actor, { action: "location.create", entity: "Location", entityId: loc.id, locationId: loc.id, after: data });
    return loc;
  });
  return { id: created.id };
}

export const POSITION_COLORS = ["cashier", "stock", "floor", "supervisor"] as const;

export const positionInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  color: z.enum(POSITION_COLORS),
});

export async function savePosition(actor: Actor, locationId: string, id: string | null, raw: z.input<typeof positionInput>) {
  assertCanManageLocation(actor, locationId);
  const input = positionInput.parse(raw);
  await db.$transaction(async (tx) => {
    const pos = id
      ? await tx.position.update({ where: { id, locationId }, data: input })
      : await tx.position.create({ data: { ...input, locationId } });
    await audit(tx, actor, { action: id ? "position.update" : "position.create", entity: "Position", entityId: pos.id, locationId, after: input });
  });
}

export async function archivePosition(actor: Actor, locationId: string, id: string, archived: boolean) {
  assertCanManageLocation(actor, locationId);
  await db.$transaction(async (tx) => {
    await tx.position.update({ where: { id, locationId }, data: { archivedAt: archived ? new Date() : null } });
    await audit(tx, actor, { action: archived ? "position.archive" : "position.restore", entity: "Position", entityId: id, locationId });
  });
}
