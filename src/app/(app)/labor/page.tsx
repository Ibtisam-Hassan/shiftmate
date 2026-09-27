import { Download } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/authz/actor";
import { laborReport } from "@/server/services/labor-report";
import { CostChart } from "./cost-chart";
import { StoreBudgets } from "./store-budgets";
import { PeopleTable, WeeksTable } from "./tables";

export const metadata = { title: "Labor cost" };

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function LaborPage({ searchParams }: PageProps<"/labor">) {
  const actor = await requireActor();
  if (actor.role === "EMPLOYEE") redirect("/my-shifts");
  const { store, week } = await searchParams;
  const r = await laborReport(actor, { storeId: typeof store === "string" ? store : undefined, week: typeof week === "string" ? week : undefined });
  const q = (next: { store?: string; week?: string }) => {
    const p = new URLSearchParams();
    const s = "store" in next ? next.store : typeof store === "string" ? store : undefined;
    if (s) p.set("store", s);
    p.set("week", next.week ?? r.selected);
    return `?${p}`;
  };
  // Skip weeks before the first one with any cost, so a new store doesn't show an empty chart.
  const first = Math.max(0, Math.min(...r.stores.map((s) => s.weeks.findIndex((w) => w.totalCents > 0)).filter((i) => i >= 0), r.weeks.length - 4));
  const sel = r.stores.map((s) => s.weeks.find((w) => w.weekStart === r.selected)!);
  const total = sel.reduce((a, w) => a + w.totalCents, 0);
  const ot = sel.reduce((a, w) => a + w.overtimeCents, 0);
  const budget = r.stores.every((s) => s.budgetCents != null) ? r.stores.reduce((a, s) => a + (s.budgetCents ?? 0), 0) : null;

  return (
    <>
      <PageHeader title="Labor cost" description="Scheduled cost by week. Overtime counts hours at every store."
        actions={<Button asChild variant="outline"><a href={`/labor/export${q({})}`}><Download /> Download CSV</a></Button>} />
      {r.allStores.length > 1 && (
        <nav aria-label="Store" className="mb-4 flex flex-wrap gap-1 border-b">
          {[{ id: undefined, name: "All stores" }, ...r.allStores].map((s) => (
            <Link key={s.id ?? "all"} href={q({ store: s.id })} aria-current={store === s.id || (!store && !s.id) ? "page" : undefined}
              className={cn("-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground", (store === s.id || (!store && !s.id)) && "border-primary text-foreground")}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="mb-6 flex flex-wrap gap-8">
        <div><p className="text-xs text-muted-foreground">Week of {shortDate(r.selected)}</p><p className="font-numeric text-4xl leading-none">{formatCents(total, { compact: true })}</p></div>
        <div><p className="text-xs text-muted-foreground">Overtime</p><p className={cn("font-numeric text-4xl leading-none", ot > 0 && "text-overtime")}>{formatCents(ot, { compact: true })}</p></div>
        {budget != null && <div><p className="text-xs text-muted-foreground">Of weekly budget</p><p className={cn("font-numeric text-4xl leading-none", total > budget && "text-danger")}>{Math.round((total / budget) * 100)}%</p></div>}
      </div>
      <StoreBudgets stores={r.stores} week={r.selected} />
      <div className="grid gap-8 xl:grid-cols-2">
        {r.stores.map((s) => (
          <section key={s.id} className="grid gap-2">
            <CostChart weeks={s.weeks.slice(first)} budgetCents={s.budgetCents} thisWeek={r.thisWeek} title={s.name} />
            <WeeksTable store={s} />
          </section>
        ))}
      </div>
      <section className="mt-8 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">People, week of {shortDate(r.selected)}</h2>
          <nav aria-label="Week" className="ml-auto flex flex-wrap gap-1">
            {r.weeks.slice(-5).map((w) => (
              <Link key={w} href={q({ week: w })} aria-current={w === r.selected ? "page" : undefined}
                className={cn("rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent", w === r.selected && "bg-foreground text-background hover:bg-foreground")}>
                {w === r.thisWeek ? "This week" : shortDate(w)}
              </Link>
            ))}
          </nav>
        </div>
        <PeopleTable people={r.people} threshold={r.overtimeThreshold} showStore={r.stores.length > 1} />
      </section>
    </>
  );
}
