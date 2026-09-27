import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, localDateOf, toDbDate } from "@/domain/time";
import { audit } from "@/server/audit";
import type { Actor } from "@/server/authz/policy";
import { homeTimezone } from "./home";

export const windowInput = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
}).refine((w) => w.endMinute > w.startMinute, "The end must be after the start");

export type UnavailableWindow = z.infer<typeof windowInput>;

/** The "can't work" windows that apply from today on. */
export async function myUnavailability(actor: Actor): Promise<UnavailableWindow[]> {
  const today = localDateOf(new Date(), await homeTimezone(actor.id));
  const rows = await db.availability.findMany({
    where: { userId: actor.id, kind: "UNAVAILABLE", OR: [{ effectiveTo: null }, { effectiveTo: { gte: toDbDate(today) } }] },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });
  return rows.map((r) => ({ dayOfWeek: r.dayOfWeek, startMinute: r.startMinute, endMinute: r.endMinute }));
}

/**
 * Replaces the person's weekly windows from today. Old windows are closed off, not deleted,
 * so past weeks still show why someone was or wasn't scheduled.
 */
export async function saveUnavailability(actor: Actor, raw: unknown) {
  const windows = z.array(windowInput).max(40).parse(raw);
  const today = localDateOf(new Date(), await homeTimezone(actor.id));
  await db.$transaction(async (tx) => {
    const current = { userId: actor.id, kind: "UNAVAILABLE" as const, OR: [{ effectiveTo: null }, { effectiveTo: { gte: toDbDate(today) } }] };
    await tx.availability.deleteMany({ where: { ...current, effectiveFrom: { gte: toDbDate(today) } } });
    await tx.availability.updateMany({ where: current, data: { effectiveTo: toDbDate(addDays(today, -1)) } });
    await tx.availability.createMany({
      data: windows.map((w) => ({ ...w, userId: actor.id, kind: "UNAVAILABLE" as const, effectiveFrom: toDbDate(today) })),
    });
    await audit(tx, actor, { action: "availability.save", entity: "User", entityId: actor.id, after: windows });
  });
}
