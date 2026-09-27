import "server-only";
import { db } from "@/lib/db";
import { type Actor, ForbiddenError, managedLocationIds } from "@/server/authz/policy";

/** Audit actions in plain words. Unknown actions fall back to their raw name. */
const LABELS: Record<string, string> = {
  "shift.create": "added a shift", "shift.update": "changed a shift", "shift.delete": "deleted a shift",
  "shift.open": "made a shift open", "shift.assign": "assigned a shift", "conflict.keep": "kept a shift despite a warning",
  "overtime.approve": "approved overtime", "week.publish": "published a week", "week.copy": "copied last week",
  "person.create": "added a person", "person.update": "changed a person", "person.active": "reactivated a person",
  "person.deactivated": "deactivated a person", "pay_rate.set": "set a pay rate",
  "time_off.request": "asked for time off", "time_off.approve": "approved time off", "time_off.deny": "denied time off",
  "time_off.cancel": "cancelled time off", "swap.request": "offered a shift swap", "swap.accept": "accepted a swap",
  "swap.decline": "declined a swap", "swap.approve": "approved a swap", "swap.reject": "did not approve a swap",
  "swap.cancel": "cancelled a swap offer", "availability.save": "changed their availability",
  "org.rules": "changed the overtime rules", "location.create": "added a store", "location.update": "changed a store",
  "position.create": "added a position", "position.update": "changed a position",
  "position.archive": "archived a position", "position.restore": "restored a position",
};

export interface ActivityRow { id: string; at: string; who: string; what: string; store: string | null; note: string | null }

export async function recentActivity(actor: Actor, take = 100): Promise<ActivityRow[]> {
  if (actor.role === "EMPLOYEE") throw new ForbiddenError();
  const scope = managedLocationIds(actor);
  const rows = await db.auditLog.findMany({
    where: scope ? { locationId: { in: scope } } : {},
    include: { actor: { select: { name: true } } },
    orderBy: { at: "desc" },
    take,
  });
  const stores = new Map((await db.location.findMany({ select: { id: true, name: true } })).map((l) => [l.id, l.name]));
  return rows.map((r) => {
    const after = (r.after ?? {}) as Record<string, unknown>;
    return {
      id: r.id, at: r.at.toISOString(), who: r.actor?.name ?? "System",
      what: LABELS[r.action] ?? r.action, store: r.locationId ? stores.get(r.locationId) ?? null : null,
      note: typeof after.reason === "string" ? after.reason : typeof after.note === "string" ? after.note : null,
    };
  });
}
