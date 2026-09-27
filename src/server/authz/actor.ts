import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Actor } from "./policy";

/** The signed-in user with their scope, loaded once per request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { managerOf: true, locations: true },
  });
  if (!user || user.status === "DEACTIVATED") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isDemo: user.isDemo,
    managedLocationId: user.managerOf?.locationId ?? null,
    memberLocationIds: user.locations.map((l) => l.locationId),
  };
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}
