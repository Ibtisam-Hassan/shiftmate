import "server-only";
import { db } from "@/lib/db";
import { addDays, localDateOf } from "@/domain/time";
import { type Actor, managedLocationIds } from "@/server/authz/policy";

export interface TimeOffRow {
  id: string;
  userId: string;
  name: string;
  from: string;
  to: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
  reviewNote: string | null;
  reviewer: string | null;
  /** Shifts the person already has in the period (managers only). */
  shiftsInPeriod: number;
}

const TZ_FALLBACK = "America/Chicago";

/** Employees see their own requests. Managers and admins see requests from their stores' staff. */
export async function listTimeOff(actor: Actor): Promise<TimeOffRow[]> {
  const scope = managedLocationIds(actor);
  const where = actor.role === "EMPLOYEE"
    ? { userId: actor.id }
    : scope ? { user: { locations: { some: { locationId: { in: scope } } } } } : {};
  const rows = await db.timeOffRequest.findMany({
    where: { ...where, endsAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
    include: {
      user: { select: { name: true, locations: { orderBy: { isHome: "desc" }, take: 1, include: { location: { select: { timezone: true } } } } } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
  });
  return Promise.all(rows.map(async (r) => {
    const tz = r.user.locations[0]?.location.timezone ?? TZ_FALLBACK;
    const shiftsInPeriod = actor.role === "EMPLOYEE" || r.status !== "PENDING" ? 0
      : await db.shift.count({ where: { userId: r.userId, startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt } } });
    return {
      id: r.id, userId: r.userId, name: r.user.name, reason: r.reason, status: r.status, reviewNote: r.reviewNote,
      reviewer: r.reviewedBy?.name ?? null, shiftsInPeriod,
      from: localDateOf(r.startsAt, tz), to: addDays(localDateOf(r.endsAt, tz), -1),
    };
  }));
}
