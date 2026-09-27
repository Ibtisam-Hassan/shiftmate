import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { Board } from "@/server/services/board";
import { hours } from "./format";

function Stat({ label, value, sub, valueClass }: { label: string; value: string; sub?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="border-r px-3 py-2 first:pl-0 last:border-r-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-numeric text-[28px] leading-none", valueClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function vsLastWeek(now: number, before: number | undefined, fmt: (n: number) => string) {
  if (before === undefined) return null;
  const d = now - before;
  if (Math.abs(d) < 1) return "same as last week";
  return `${d > 0 ? "▲" : "▼"} ${fmt(Math.abs(d))} vs last week`;
}

function BudgetMeter({ board }: { board: Board }) {
  const labor = board.labor!;
  const budget = board.location.weeklyBudgetCents!;
  const pct = (c: number) => Math.min(100, (c / budget) * 100);
  const over = labor.totalCents > budget;
  return (
    <div className="min-w-64 flex-1 px-3 py-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{board.location.name} weekly budget {formatCents(budget, { compact: true })}</span>
        <span className={cn("font-semibold", over && "text-danger")}>
          {formatCents(Math.abs(budget - labor.totalCents), { compact: true })} {over ? "over" : "left"}
        </span>
      </div>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-track" role="meter" aria-label="Budget used"
        aria-valuemin={0} aria-valuemax={budget} aria-valuenow={labor.totalCents}>
        <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct(labor.regularCents)}%` }} />
        <div className="absolute inset-y-0 bg-[repeating-linear-gradient(-45deg,var(--overtime)_0_3px,color-mix(in_oklab,var(--overtime)_55%,transparent)_3px_6px)]"
          style={{ left: `${pct(labor.regularCents)}%`, width: `${pct(labor.overtimeCents)}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>Regular {Math.round(pct(labor.regularCents))}% · Overtime {pct(labor.overtimeCents).toFixed(1)}%</span>
        <span>{Math.round((labor.totalCents / budget) * 100)}% used</span>
      </p>
    </div>
  );
}

/** Hours and cost for this store's week, compared with last week and the budget. */
export function LaborStrip({ board }: { board: Board }) {
  const labor = board.labor;
  if (!labor) return null;
  const money = (n: number) => formatCents(n, { compact: true });
  return (
    <div className="flex flex-wrap items-stretch border-y py-1">
      <Stat label="Scheduled" value={hours(labor.scheduledMinutes)} sub={vsLastWeek(labor.scheduledMinutes, labor.lastWeek?.scheduledMinutes, hours)} />
      <Stat label="Regular pay" value={money(labor.regularCents)} />
      <Stat label={`Overtime pay (${hours(labor.overtimeMinutes)} × ${board.rules.overtimeMultiplierPercent / 100})`}
        value={money(labor.overtimeCents)} valueClass={labor.overtimeCents ? "text-overtime" : undefined} />
      <Stat label="Total labor" value={money(labor.totalCents)} sub={vsLastWeek(labor.totalCents, labor.lastWeek?.totalCents, money)} />
      {board.location.weeklyBudgetCents ? <BudgetMeter board={board} /> : null}
      {labor.unpricedShifts > 0 && (
        <p className="w-full px-3 text-xs text-warning">{labor.unpricedShifts} shifts have no pay rate, so they aren&apos;t counted.</p>
      )}
    </div>
  );
}
