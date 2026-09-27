import "server-only";
import { db } from "@/lib/db";
import { type Actor, managedLocationIds } from "@/server/authz/policy";

export interface SwapRow {
  id: string;
  status: string;
  requester: { id: string; name: string };
  target: { id: string; name: string };
  shift: { id: string; startsAt: string; endsAt: string; store: string; timezone: string };
  targetShift: { startsAt: string; endsAt: string } | null;
  message: string | null;
  escalationReason: string | null;
  createdAt: string;
}

const include = {
  requester: { select: { id: true, name: true } },
  targetUser: { select: { id: true, name: true } },
  shift: { include: { location: { select: { name: true, timezone: true } } } },
  targetShift: true,
} as const;

/** Employees see swaps they are part of. Managers and admins see every swap at their stores. */
export async function listSwaps(actor: Actor): Promise<SwapRow[]> {
  const scope = managedLocationIds(actor);
  const where = actor.role === "EMPLOYEE"
    ? { OR: [{ requesterId: actor.id }, { targetUserId: actor.id }] }
    : scope ? { shift: { locationId: { in: scope } } } : {};
  const rows = await db.swapRequest.findMany({
    where: { ...where, createdAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
    include,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id, status: r.status, message: r.message, escalationReason: r.escalationReason, createdAt: r.createdAt.toISOString(),
    requester: r.requester, target: r.targetUser,
    shift: { id: r.shift.id, startsAt: r.shift.startsAt.toISOString(), endsAt: r.shift.endsAt.toISOString(), store: r.shift.location.name, timezone: r.shift.location.timezone },
    targetShift: r.targetShift && { startsAt: r.targetShift.startsAt.toISOString(), endsAt: r.targetShift.endsAt.toISOString() },
  }));
}
