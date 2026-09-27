"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { localDateOf } from "@/domain/time";
import { cn } from "@/lib/utils";
import type { Board, BoardShift } from "@/server/services/board";
import { CoverageStrip } from "./coverage-strip";
import { POSITION_BG, dayLabel, range, spokenRange, trackPosition } from "./format";
import { ShiftDetails } from "./shift-details";
import type { ShiftDraft } from "./shift-dialog";
import type { Row } from "./use-rows";

function Track({ s, color }: { s: { startMin: number; endMin: number }; color?: string }) {
  const { left, width } = trackPosition(s.startMin, s.endMin);
  return (
    <span className="relative mt-1 block h-2 rounded-full bg-track">
      <span className={cn("absolute inset-y-0 rounded-full", color ?? "border border-dashed border-muted-foreground")} style={{ left: `${left}%`, width: `${width}%` }} />
    </span>
  );
}

/** Phones: one day at a time, full-width rows, details in a bottom sheet. */
export function DayView({ board, shifts, rows, meId, onEdit }: {
  board: Board; shifts: BoardShift[]; rows: Row[]; meId: string; onEdit: (d: { shift?: BoardShift; draft?: ShiftDraft }) => void;
}) {
  // Start on today when this week is on screen, in the store's own time zone.
  const [day, setDay] = useState(() => {
    const today = localDateOf(new Date(), board.location.timezone);
    return board.days.includes(today) ? today : board.days[0];
  });
  const [open, setOpen] = useState<BoardShift | null>(null);
  const posById = new Map(board.positions.map((p) => [p.id, p]));
  const problem = (d: string) => shifts.some((s) => s.day === d && s.conflicts.some((c) => !c.overridden)) || (board.coverage[d]?.gaps.length ?? 0) > 0;
  const todays = shifts.filter((s) => s.day === day);
  const ordered = [...rows].sort((a, b) => Number(b.id === meId) - Number(a.id === meId));
  const working = ordered.filter((r) => todays.some((s) => s.userId === r.id));
  const off = ordered.length - working.length;

  const row = (key: string, name: string, list: BoardShift[], mine = false) => (
    <li key={key} className={cn("grid gap-1 border-b py-2.5", mine && "rounded-md bg-accent/60 px-2")}>
      <p className="text-sm font-semibold">{name}{mine && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}</p>
      {list.map((s) => {
        const pos = s.positionId ? posById.get(s.positionId) : undefined;
        const problems = s.conflicts.filter((c) => !c.overridden);
        return (
          <button key={s.id} type="button" onClick={() => setOpen(s)} className="min-h-11 rounded text-left"
            aria-label={`${name}, ${spokenRange(s.startMin, s.endMin)}${pos ? `, ${pos.name}` : ""}${problems.length ? `. ${problems.map((c) => c.detail).join(" ")}` : ""}`}>
            <span className="flex justify-between text-sm">
              <span className="font-semibold tabular-nums">{range(s.startMin, s.endMin)}</span>
              <span className={cn("text-muted-foreground", problems.length && "font-semibold text-warning")}>{problems.length ? "Check" : pos?.name}</span>
            </span>
            <Track s={s} color={s.userId ? POSITION_BG[pos?.color ?? ""] : undefined} />
          </button>
        );
      })}
    </li>
  );

  return (
    <div className="grid gap-3">
      <nav aria-label="Day" className="grid grid-cols-7 gap-1">
        {board.days.map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={d === day}
            className={cn("relative grid min-h-12 place-items-center rounded-md border text-xs", d === day ? "border-foreground bg-foreground text-background" : "bg-card")}>
            <span className="font-numeric text-lg leading-none">{dayLabel(d).num}</span>
            {dayLabel(d).dow}
            {problem(d) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warning" aria-label="has problems" />}
          </button>
        ))}
      </nav>
      {board.canEdit && board.coverage[day] && (
        <CoverageStrip hours={board.coverage[day].hours} gaps={board.coverage[day].gaps} min={board.rules.minCoverage} />
      )}
      <ul className="grid">
        {todays.some((s) => !s.userId) && row("open", "Open shifts", todays.filter((s) => !s.userId))}
        {working.map((r) => row(r.id, r.name, todays.filter((s) => s.userId === r.id), r.id === meId))}
      </ul>
      {off > 0 && <p className="text-xs text-muted-foreground">{off} {off === 1 ? "person is" : "people are"} not working on {dayLabel(day).long}.</p>}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl p-4">
          <SheetTitle className="sr-only">Shift details</SheetTitle>
          {open && <ShiftDetails board={{ ...board, shifts }} shift={open} onClose={() => setOpen(null)} onEdit={() => { const s = open; setOpen(null); onEdit({ shift: s }); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
