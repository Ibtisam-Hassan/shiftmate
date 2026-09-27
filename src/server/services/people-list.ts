import "server-only";
import { db } from "@/lib/db";
import { paidMinutes } from "@/domain/labor";
import { rateOn } from "@/domain/pay";
import { fromDbDate, localDateOf, weekInterval, weekStartOf } from "@/domain/time";
import { type Actor, ForbiddenError, canManageEmployee, managedLocationIds } from "@/server/authz/policy";

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
  /** Paid minutes scheduled this week, at every store. */
  weekMinutes: number;
  overtimeLimitMinutes: number;
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
  const org = await db.organization.findFirstOrThrow();
  const week = weekInterval(weekStartOf(today, org.weekStartsOn), "America/Chicago");
  const shifts = await db.shift.findMany({ where: { userId: { in: users.map((u) => u.id) }, startsAt: { gte: week.start, lt: week.end } } });
  const minutesOf = (id: string) => shifts.filter((s) => s.userId === id).reduce((a, s) => a + paidMinutes(s), 0);
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
      weekMinutes: minutesOf(u.id),
      overtimeLimitMinutes: org.overtimeThresholdMinutes,
    };
  });
}
