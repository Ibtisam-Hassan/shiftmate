import { db } from "@/lib/db";
import type { Actor } from "@/server/authz/policy";

export async function actorFor(email: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { managerOf: true, locations: true } });
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, isDemo: u.isDemo,
    managedLocationId: u.managerOf?.locationId ?? null,
    memberLocationIds: u.locations.map((l) => l.locationId),
  };
}
