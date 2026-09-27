import Link from "next/link";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/server/services/dashboard";
import { HoursMeter } from "../schedule/hours-meter";

function BudgetRow({ label, draft, totalCents, budget }: { label: string; draft?: boolean; totalCents: number; budget: number | null }) {
  const pct = budget ? Math.round((totalCents / budget) * 100) : null;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}{draft && <span className="ml-2 rounded bg-warning-bg px-1.5 text-[11px] text-warning">Draft</span>}</span>
        <span className="font-numeric text-3xl leading-none">{formatCents(totalCents, { compact: true })}</span>
      </div>
      {budget && (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-track" role="meter" aria-label={`${label}: ${pct}% of budget`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0}>
            <div className={cn("h-full", totalCents > budget ? "bg-danger" : "bg-primary")} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </div>
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>{pct}% used</span>
            <span>{formatCents(Math.abs(budget - totalCents), { compact: true })} {totalCents > budget ? "over" : "left"}</span>
          </p>
        </>
      )}
    </div>
  );
}

export function LaborBudget({ d }: { d: Dashboard }) {
  const budget = d.thisWeek.location.weeklyBudgetCents;
  return (
    <div className="grid gap-4">
      <BudgetRow label="This week" totalCents={d.thisWeek.labor?.totalCents ?? 0} budget={budget} />
      <BudgetRow label="Next week" draft={d.nextWeek.status !== "PUBLISHED"} totalCents={d.nextWeek.labor?.totalCents ?? 0} budget={budget} />
    </div>
  );
}

export function OvertimeRisk({ d }: { d: Dashboard }) {
  const limit = d.nextWeek.rules.overtimeThresholdMinutes;
  if (!d.closeToOvertime.length) return <p className="text-sm text-muted-foreground">Nobody is close to the weekly limit next week.</p>;
  return (
    <ul className="grid gap-2">
      {d.closeToOvertime.map((p) => (
        <li key={p.id} className="grid grid-cols-[8rem_1fr] items-center gap-3">
          <span className="truncate text-sm">{p.name}</span>
          <HoursMeter minutes={p.minutes} threshold={limit} approved={p.approved} />
        </li>
      ))}
    </ul>
  );
}

export function Recent({ d }: { d: Dashboard }) {
  if (!d.activity.length) return <p className="text-sm text-muted-foreground">No changes yet.</p>;
  return (
    <div className="grid gap-2">
      <ol className="grid gap-2 border-l-2 pl-3">
        {d.activity.map((a) => (
          <li key={a.id} className="text-sm"><span className="font-semibold">{a.who}</span> {a.what}{a.store && ` at ${a.store}`}.</li>
        ))}
      </ol>
      <Link href="/activity" className="text-sm underline underline-offset-2">All activity</Link>
    </div>
  );
}
