import "server-only";
import { db } from "@/lib/db";
import { type Actor, managedLocationIds } from "@/server/authz/policy";

/** Counts for the nav badges: things waiting on this person. */
export async function navCounts(actor: Actor): Promise<Record<string, number>> {
  if (actor.role === "EMPLOYEE") {
    const swaps = await db.swapRequest.count({ where: { targetUserId: actor.id, status: "PENDING_COWORKER" } });
    return { "/my-shifts": swaps };
  }
  const scope = managedLocationIds(actor);
  const staff = scope ? { user: { locations: { some: { locationId: { in: scope } } } } } : {};
  const [timeOff, swaps] = await Promise.all([
    db.timeOffRequest.count({ where: { status: "PENDING", ...staff } }),
    db.swapRequest.count({ where: { status: "PENDING_MANAGER", ...(scope ? { shift: { locationId: { in: scope } } } : {}) } }),
  ]);
  return { "/requests": timeOff + swaps };
}
