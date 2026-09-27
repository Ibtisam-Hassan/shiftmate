import { AppShell } from "@/components/app-shell";
import { navFor } from "@/components/nav";
import { db } from "@/lib/db";
import { requireActor } from "@/server/authz/actor";
import { navCounts } from "@/server/services/nav-counts";
import { unreadCount } from "@/server/services/notifications";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requireActor();
  let scope = "All stores · Admin";
  if (actor.role === "MANAGER" && actor.managedLocationId) {
    const loc = await db.location.findUnique({ where: { id: actor.managedLocationId }, select: { name: true } });
    scope = `${loc?.name ?? "Store"} · Manager`;
  } else if (actor.role === "EMPLOYEE") {
    scope = "Employee";
  }
  return (
    <AppShell
      user={{ name: actor.name, email: actor.email, role: actor.role, scope, isDemo: actor.isDemo, unread: await unreadCount(actor) }}
      nav={navFor(actor.role, await navCounts(actor))}
    >
      {children}
    </AppShell>
  );
}
