import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { StoreReport } from "@/server/services/labor-report";

/** The page's first answer: is each store over budget in the chosen week? */
export function StoreBudgets({ stores, week }: { stores: StoreReport[]; week: string }) {
  return (
    <ul className="mb-8 grid max-w-3xl gap-3">
      {stores.map((s) => {
        const w = s.weeks.find((x) => x.weekStart === week)!;
        const pct = s.budgetCents ? Math.round((w.totalCents / s.budgetCents) * 100) : null;
        const over = s.budgetCents != null && w.totalCents > s.budgetCents;
        return (
          <li key={s.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
            <span className="font-medium">{s.name}{w.draft && <span className="ml-1 text-xs font-normal text-warning">draft</span>}</span>
            {s.budgetCents ? (
              <div className="h-2.5 overflow-hidden rounded-full bg-track" role="meter" aria-label={`${s.name}: ${pct}% of budget`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0}>
                <div className={cn("h-full", over ? "bg-danger" : pct! >= 90 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, pct!)}%` }} />
              </div>
            ) : <span className="text-sm text-muted-foreground">No budget set</span>}
            <span className={cn("text-right text-sm tabular-nums", over && "font-semibold text-danger")}>
              {formatCents(w.totalCents, { compact: true })}
              {s.budgetCents ? ` · ${pct}% · ${formatCents(Math.abs(s.budgetCents - w.totalCents), { compact: true })} ${over ? "over" : "left"}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
