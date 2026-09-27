import { db } from "@/lib/db";
import { requireActor } from "@/server/authz/actor";
import { canViewLocation } from "@/server/authz/policy";
import { getBoard } from "@/server/services/board";
import { ScheduleBoard } from "./schedule-board";

export const metadata = { title: "Schedule" };

async function defaultStore(actor: Awaited<ReturnType<typeof requireActor>>) {
  if (actor.managedLocationId) return actor.managedLocationId;
  if (actor.role === "EMPLOYEE") {
    const home = await db.employeeLocation.findFirst({ where: { userId: actor.id }, orderBy: { isHome: "desc" } });
    if (home) return home.locationId;
  }
  const first = await db.location.findFirst({ where: { archivedAt: null }, orderBy: { name: "asc" } });
  return first?.id ?? null;
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const actor = await requireActor();
  const { store, week } = await searchParams;
  const requested = typeof store === "string" && canViewLocation(actor, store) ? store : null;
  const locationId = requested ?? (await defaultStore(actor));
  if (!locationId) return <p className="text-muted-foreground">No stores yet. An admin can add one in Settings.</p>;
  const board = await getBoard(actor, locationId, typeof week === "string" ? week : undefined);
  // A new key per store/week resets filters and selection when navigating.
  return <ScheduleBoard key={`${board.location.id}|${board.weekStart}`} board={board} meId={actor.id} />;
}
