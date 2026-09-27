import { cn } from "@/lib/utils";
import { hours } from "./format";

const SCALE = 48 * 60;

/** 0–48 h track, tick at the overtime limit, overtime zone tinted before anyone reaches it. */
export function HoursMeter({ minutes, threshold, approved, className, showLabel = true, after }: {
  minutes: number; threshold: number; approved?: boolean; className?: string; showLabel?: boolean; after?: number;
}) {
  const pct = (m: number) => Math.min(100, (m / SCALE) * 100);
  const over = minutes > threshold;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-track"
        role="meter" aria-valuemin={0} aria-valuemax={SCALE / 60} aria-valuenow={Math.round(minutes / 6) / 10}
        aria-label={`${hours(minutes)} scheduled of ${hours(threshold)} before overtime`}
      >
        <div className="absolute inset-y-0 right-0 bg-overtime/15" style={{ left: `${pct(threshold)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${pct(Math.min(minutes, threshold))}%` }} />
        {over && <div className="absolute inset-y-0 bg-overtime" style={{ left: `${pct(threshold)}%`, width: `${pct(minutes) - pct(threshold)}%` }} />}
        {after !== undefined && after > minutes && (
          <div className="absolute inset-y-0 border-y border-r border-dashed border-foreground/60" style={{ left: `${pct(minutes)}%`, width: `${pct(after) - pct(minutes)}%` }} />
        )}
        <div className="absolute inset-y-[-2px] w-[1.5px] bg-foreground" style={{ left: `${pct(threshold)}%` }} />
      </div>
      {showLabel && (
        <span className={cn("w-12 text-right text-xs font-semibold tabular-nums", over && !approved && "text-overtime")}>
          {hours(after ?? minutes)}
          {over && approved && <span className="sr-only"> overtime approved</span>}
        </span>
      )}
    </div>
  );
}
