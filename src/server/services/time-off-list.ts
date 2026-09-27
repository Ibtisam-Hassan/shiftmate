import "server-only";
import { db } from "@/lib/db";
import { clockTime, whenAt } from "@/domain/format";
import { addDays, localDateOf, localMinuteOf } from "@/domain/time";
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
  affected: { id: string; label: string; href: string }[];
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
    const shifts = actor.role === "EMPLOYEE" || r.status !== "PENDING" ? []
      : await db.shift.findMany({
          where: { userId: r.userId, startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt } },
          include: { location: { select: { name: true, timezone: true } }, position: { select: { name: true } } },
          orderBy: { startsAt: "asc" },
        });
    const affected = shifts.map((s) => ({
      id: s.id,
      label: `${whenAt(s.startsAt, s.location.timezone)} to ${clockTime(localMinuteOf(s.endsAt, s.location.timezone))}, ${s.position?.name ?? "shift"} at ${s.location.name}`,
      href: `/schedule?store=${s.locationId}&week=${localDateOf(s.startsAt, s.location.timezone)}`,
    }));
    return {
      id: r.id, userId: r.userId, name: r.user.name, reason: r.reason, status: r.status, reviewNote: r.reviewNote,
      reviewer: r.reviewedBy?.name ?? null, shiftsInPeriod: shifts.length, affected,
      from: localDateOf(r.startsAt, tz), to: addDays(localDateOf(r.endsAt, tz), -1),
    };
  }));
}
