import type { CoverageHour } from "@/domain/coverage";
import { cn } from "@/lib/utils";

const label = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;

export function CoverageStrip({ hours, gaps, min }: { hours: CoverageHour[]; gaps: [number, number][]; min: number }) {
  const max = Math.max(6, ...hours.map((h) => h.count));
  return (
    <div className="grid gap-0.5">
      <div className="flex h-[18px] items-end gap-px" aria-hidden>
        {hours.map((h) => (
          <div
            key={h.hour}
            title={`${label(h.hour)}: ${h.count} ${h.count === 1 ? "person" : "people"}${h.gap ? `, below minimum of ${min}` : ""}`}
            className={cn(
              "flex-1 rounded-t-[1px]",
              !h.open ? "bg-track" : h.gap ? "h-full border border-danger bg-[repeating-linear-gradient(-45deg,var(--danger)_0_2px,transparent_2px_4px)]" : "bg-muted-foreground/45",
            )}
            style={h.gap ? undefined : { height: `${Math.max(8, (h.count / max) * 100)}%` }}
          />
        ))}
      </div>
      {gaps.length ? (
        <p className="truncate text-[10.5px] font-semibold text-danger">
          <span aria-hidden>▨ </span>
          <span className="sr-only">Coverage gap: </span>
          {gaps.map(([a, b]) => `${label(a)}–${label(b)}`).join(", ")}
        </p>
      ) : (
        <div className="flex justify-between text-[10.5px] text-muted-foreground" aria-hidden>
          <span>6a</span><span>12p</span><span>6p</span>
        </div>
      )}
    </div>
  );
}
