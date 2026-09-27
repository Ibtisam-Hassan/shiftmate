import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { whenAt } from "@/domain/format";
import { requireActor } from "@/server/authz/actor";
import { recentActivity } from "@/server/services/activity";

export const metadata = { title: "Activity" };

// Activity lists every store; the demo stores all run on Chicago time.
const when = (iso: string) => whenAt(new Date(iso), "America/Chicago");

export default async function ActivityPage() {
  const actor = await requireActor();
  if (actor.role === "EMPLOYEE") redirect("/my-shifts");
  const rows = await recentActivity(actor);
  return (
    <>
      <PageHeader title="Activity" description={actor.role === "ADMIN" ? "The last 100 changes at every store." : "The last 100 changes at your store."} />
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No changes yet. When someone edits the schedule or a request, it shows here.</p>
      ) : (
        <ol className="grid max-w-3xl divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-0.5 px-4 py-2.5 sm:grid-cols-[11rem_1fr]">
              <time dateTime={r.at} className="text-sm text-muted-foreground tabular-nums">{when(r.at)}</time>
              <p className="text-sm">
                <span className="font-semibold">{r.who}</span> {r.what}
                {r.store && <span className="text-muted-foreground"> at {r.store}</span>}.
                {r.note && <span className="text-muted-foreground"> Reason: {r.note}</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
