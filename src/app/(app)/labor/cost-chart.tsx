"use client";

import { useId, useState } from "react";
import { formatCents } from "@/domain/pay";
import type { WeekCost } from "@/server/services/labor-report";

const W = 640, H = 220, PAD = { top: 16, right: 12, bottom: 28, left: 48 };
const BAR = 24, GAP = 2, RADIUS = 4;

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const money = (c: number) => formatCents(c, { compact: true });

/** A column with a 4px rounded top and a square base. */
function topRounded(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** A round axis step (1, 2, 2.5 or 5 × 10^n) giving at most 5 gridlines. */
function niceStep(v: number) {
  const base = 10 ** Math.floor(Math.log10(Math.max(v / 5, 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * base).find((step) => v / step <= 5)!;
}

/** Weekly labor cost: regular (solid) and overtime (hatched) stacked, against the weekly budget. */
export function CostChart({ weeks, budgetCents, thisWeek, title }: { weeks: WeekCost[]; budgetCents: number | null; thisWeek: string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const hatch = useId();
  const top = Math.max(budgetCents ?? 0, ...weeks.map((w) => w.totalCents)) * 1.08;
  const step = niceStep(top);
  const max = Math.ceil(top / step) * step;
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const band = plotW / weeks.length;
  const y = (c: number) => PAD.top + plotH - (c / max) * plotH;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const active = hover === null ? null : weeks[hover];

  return (
    <figure className="relative grid w-full max-w-[720px] gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-chart-regular" aria-hidden />Regular pay</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[repeating-linear-gradient(45deg,var(--chart-overtime)_0_2px,transparent_2px_4px)] ring-1 ring-chart-overtime" aria-hidden />Overtime pay</span>
          {budgetCents != null && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-foreground" aria-hidden />Budget {money(budgetCents)}</span>}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}. Weekly labor cost for ${weeks.length} weeks. The table below has the numbers.`}>
        <defs>
          <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="var(--chart-overtime)" opacity="0.35" />
            <rect width="2" height="4" fill="var(--chart-overtime)" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t ? 1 : 1.5} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{money(t)}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = PAD.left + i * band + (band - BAR) / 2;
          const regTop = y(w.regularCents);
          const hasOt = w.overtimeCents > 0;
          const otTop = y(w.totalCents);
          const now = w.weekStart === thisWeek;
          return (
            <g key={w.weekStart} tabIndex={0} role="button" opacity={w.draft ? 0.55 : 1} aria-label={`Week of ${shortDate(w.weekStart)}: ${money(w.totalCents)}`}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              className="outline-none focus-visible:[&>rect:first-child]:stroke-ring">
              <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="transparent" strokeWidth={2} />
              {w.regularCents > 0 && (hasOt
                ? <rect x={x} y={regTop} width={BAR} height={y(0) - regTop} fill="var(--chart-regular)" />
                : <path d={topRounded(x, regTop, BAR, y(0) - regTop)} fill="var(--chart-regular)" />)}
              {hasOt && <path d={topRounded(x, otTop, BAR, Math.max(1, regTop - GAP - otTop))} fill={`url(#${hatch})`} />}
              {now && <text x={x + BAR / 2} y={otTop - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground)" stroke="var(--card)" strokeWidth={3} paintOrder="stroke">{money(w.totalCents)}</text>}
              <text x={x + BAR / 2} y={H - 8} textAnchor="middle" fontSize="11" fontWeight={now ? 700 : 400} fill={now ? "var(--foreground)" : "var(--muted-foreground)"}>
                {now ? "This week" : w.draft ? `${shortDate(w.weekStart)} draft` : shortDate(w.weekStart)}
              </text>
            </g>
          );
        })}
        {budgetCents != null && (
          <g pointerEvents="none">
            <line x1={PAD.left} x2={W - PAD.right} y1={y(budgetCents)} y2={y(budgetCents)} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="5 4" />
          </g>
        )}
      </svg>
      {active && (
        <div role="status" className="pointer-events-none absolute top-8 right-2 rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
          <p className="text-muted-foreground">Week of {shortDate(active.weekStart)}</p>
          <p className="text-base font-semibold">{money(active.totalCents)}</p>
          <p><span className="font-semibold">{money(active.regularCents)}</span> regular</p>
          <p><span className="font-semibold">{money(active.overtimeCents)}</span> overtime</p>
          <p><span className="font-semibold">{Math.round(active.scheduledMinutes / 60)} h</span> scheduled</p>
          {budgetCents != null && <p>{Math.round((active.totalCents / budgetCents) * 100)}% of budget</p>}
        </div>
      )}
    </figure>
  );
}
