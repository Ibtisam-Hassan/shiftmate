import "server-only";
import { db } from "@/lib/db";

/** The time zone of the person's home store, used for all-day dates like time off. */
export async function homeTimezone(userId: string) {
  const link = await db.employeeLocation.findFirst({
    where: { userId },
    orderBy: { isHome: "desc" },
    include: { location: { select: { timezone: true } } },
  });
  if (link) return link.location.timezone;
  const managed = await db.managerAssignment.findUnique({ where: { userId }, include: { location: { select: { timezone: true } } } });
  return managed?.location.timezone ?? "America/Chicago";
}

/** Managers and admins who look after any of this person's stores. */
export async function approversFor(userId: string) {
  const stores = (await db.employeeLocation.findMany({ where: { userId } })).map((l) => l.locationId);
  const people = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ role: "ADMIN" }, { role: "MANAGER", managerOf: { locationId: { in: stores } } }],
    },
    select: { id: true },
  });
  return people.map((p) => p.id);
}
