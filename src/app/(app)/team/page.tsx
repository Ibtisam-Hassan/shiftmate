import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/authz/actor";
import { managedLocationIds } from "@/server/authz/policy";
import { listTeam } from "@/server/services/people";
import { PersonDialog } from "./person-dialog";
import { TeamTable } from "./team-table";
import { redirect } from "next/navigation";

export const metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const actor = await requireActor();
  if (actor.role === "EMPLOYEE") redirect("/my-shifts");
  const { store } = await searchParams;
  const scope = managedLocationIds(actor);
  const locations = await db.location.findMany({
    where: { archivedAt: null, ...(scope ? { id: { in: scope } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const storeId = typeof store === "string" && locations.some((l) => l.id === store) ? store : undefined;
  const team = await listTeam(actor, { locationId: storeId });

  return (
    <>
      <PageHeader
        title="Team"
        description={
          actor.role === "ADMIN"
            ? "Everyone across your stores. New people get a sign-in link by email."
            : `Staff at ${locations[0]?.name ?? "your store"}. New people get a sign-in link by email.`
        }
        actions={<PersonDialog locations={locations} actorRole={actor.role} />}
      />
      {actor.role === "ADMIN" && (
        <nav aria-label="Filter by store" className="mb-4 flex flex-wrap gap-1 border-b">
          {[{ id: undefined, name: "All stores" }, ...locations].map((l) => (
            <Link
              key={l.id ?? "all"}
              href={l.id ? `/team?store=${l.id}` : "/team"}
              aria-current={storeId === l.id ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
                storeId === l.id && "border-primary text-foreground",
              )}
            >
              {l.name}
            </Link>
          ))}
        </nav>
      )}
      <TeamTable team={team} locations={locations} actorRole={actor.role} actorId={actor.id} />
    </>
  );
}
