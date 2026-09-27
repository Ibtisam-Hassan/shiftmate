"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TRACK_END, TRACK_START } from "@/domain/coverage";
import { clockTime } from "@/domain/format";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/server/services/dashboard";
import { AssignPanel } from "../schedule/assign-panel";
import { CoverageStrip } from "../schedule/coverage-strip";
import { POSITION_BG, range, trackPosition } from "../schedule/format";

function status(startMin: number, endMin: number, now: number) {
  if (now >= endMin) return "Done";
  if (now >= startMin) return `On now, until ${clockTime(endMin)}`;
  const mins = startMin - now;
  return `Starts in ${mins >= 60 ? `${Math.floor(mins / 60)} h ` : ""}${mins % 60} min`;
}

/** Today at one store, drawn on the same 6 am to 11 pm track as the grid. */
export function TodayFloor({ d }: { d: Dashboard }) {
  const [open, setOpen] = useState<string | null>(null);
  const nowPct = ((Math.min(Math.max(d.nowMinute, TRACK_START), TRACK_END) - TRACK_START) / (TRACK_END - TRACK_START)) * 100;
  const people = new Map(d.thisWeek.people.map((p) => [p.id, p.name]));
  const posById = new Map(d.thisWeek.positions.map((p) => [p.id, p]));
  if (!d.todayShifts.length) return <p className="text-muted-foreground">Nobody is scheduled here today.</p>;

  return (
    <div className="grid gap-1">
      {d.todayCoverage && (
        <div className="grid items-end gap-3 sm:grid-cols-[9rem_1fr_9rem]">
          <p className="text-xs text-muted-foreground">People each hour, min {d.thisWeek.rules.minCoverage}</p>
          <CoverageStrip hours={d.todayCoverage.hours} gaps={d.todayCoverage.gaps} min={d.thisWeek.rules.minCoverage} />
          <span />
        </div>
      )}
      <ul className="grid">
        {d.todayShifts.map((s) => {
          const pos = s.positionId ? posById.get(s.positionId) : undefined;
          const { left, width } = trackPosition(s.startMin, s.endMin);
          const isOpen = !s.userId;
          return (
            <li key={s.id} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b py-2 last:border-0 sm:grid-cols-[9rem_1fr_9rem]", isOpen && "bg-accent/40")}>
              <p className="min-w-0">
                <span className="block truncate text-sm font-semibold">{isOpen ? "Open shift" : people.get(s.userId!)}</span>
                <span className="block text-xs text-muted-foreground">{pos?.name}</span>
              </p>
              <div className="relative order-last col-span-2 h-6 sm:order-none sm:col-span-1">
                <span className="absolute top-0 text-xs font-semibold tabular-nums" style={{ left: `${left}%` }}>{range(s.startMin, s.endMin)}</span>
                <span className="absolute inset-x-0 bottom-1 h-1.5 rounded-full bg-track" />
                <span className={cn("absolute bottom-1 h-1.5 rounded-full", isOpen ? "border border-dashed border-muted-foreground bg-transparent" : POSITION_BG[pos?.color ?? ""])}
                  style={{ left: `${left}%`, width: `${width}%` }} />
                <span className="absolute inset-y-0 w-0.5 bg-ring" style={{ left: `${nowPct}%` }} aria-hidden />
              </div>
              {isOpen ? (
                <Popover open={open === s.id} onOpenChange={(o) => setOpen(o ? s.id : null)}>
                  <PopoverTrigger asChild><Button size="sm" variant="outline" className="w-fit">Assign…</Button></PopoverTrigger>
                  <PopoverContent className="w-[360px]" align="end">
                    <AssignPanel shiftId={s.id} title={`Assign ${range(s.startMin, s.endMin)}`} threshold={d.thisWeek.rules.overtimeThresholdMinutes} onDone={() => setOpen(null)} />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="text-xs text-muted-foreground">{status(s.startMin, s.endMin, d.nowMinute)}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">The blue line is now, {clockTime(d.nowMinute)}.</p>
    </div>
  );
}
