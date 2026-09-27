import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { PersonCost, StoreReport } from "@/server/services/labor-report";

const money = (c: number) => formatCents(c, { compact: true });
const hrs = (m: number) => `${Math.round((m / 60) * 10) / 10} h`;
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The chart's numbers as a table, for screen readers and anyone who wants exact values. */
export function WeeksTable({ store }: { store: StoreReport }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">Show the numbers for {store.name}</summary>
      <table className="mt-2 w-full text-right tabular-nums">
        <thead className="text-xs text-muted-foreground">
          <tr><th className="text-left font-medium">Week of</th><th className="font-medium">Hours</th><th className="font-medium">Regular</th><th className="font-medium">Overtime</th><th className="font-medium">Total</th>{store.budgetCents != null && <th className="font-medium">Of budget</th>}</tr>
        </thead>
        <tbody>
          {store.weeks.map((w) => (
            <tr key={w.weekStart} className="border-t">
              <td className="py-1 text-left">{shortDate(w.weekStart)}{w.draft && <span className="ml-1 text-xs text-warning">draft</span>}</td><td>{hrs(w.scheduledMinutes)}</td><td>{money(w.regularCents)}</td>
              <td>{money(w.overtimeCents)}</td><td className="font-semibold">{money(w.totalCents)}</td>
              {store.budgetCents != null && <td className={cn(w.totalCents > store.budgetCents && "text-danger")}>{Math.round((w.totalCents / store.budgetCents) * 100)}%</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Who costs what in the chosen week: one row per person. Hours count every store. */
export function PeopleTable({ people, threshold, showStore }: { people: PersonCost[]; threshold: number; showStore: boolean }) {
  if (!people.length) return <p className="text-sm text-muted-foreground">Nobody is scheduled that week.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Person</th>
            {showStore && <th className="px-3 py-2 text-left font-medium">Stores</th>}
            <th className="px-3 py-2 text-right font-medium">Hours, all stores</th>
            <th className="px-3 py-2 text-right font-medium">Overtime</th>
            <th className="px-3 py-2 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.userId} className="border-t">
              <td className="px-3 py-2 font-medium">{p.name}</td>
              {showStore && <td className="px-3 py-2">{p.stores.map((s) => p.stores.length > 1 ? `${s.name} ${formatCents(s.costCents, { compact: true })}` : s.name).join(", ")}</td>}
              <td className={cn("px-3 py-2 text-right", p.minutes > threshold && "font-semibold text-overtime")}>{hrs(p.minutes)}</td>
              <td className="px-3 py-2 text-right">{p.overtimeMinutes ? hrs(p.overtimeMinutes) : "None"}</td>
              <td className="px-3 py-2 text-right">{formatCents(p.costCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
