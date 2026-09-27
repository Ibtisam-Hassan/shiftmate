"use client";

import { cn } from "@/lib/utils";
import type { Board, BoardShift } from "@/server/services/board";
import { CoverageStrip } from "./coverage-strip";
import { type Verdict, cellId, parseCell } from "./drop-rules";
import { POSITION_BG, dayLabel, hours, weekTitle } from "./format";
import { GridCell } from "./grid-cell";
import { HoursMeter } from "./hours-meter";
import type { ShiftDraft } from "./shift-dialog";
import type { Row } from "./use-rows";

interface Props {
  board: Board;
  shifts: BoardShift[];
  rows: Row[];
  verdicts: Map<string, Verdict>;
  overId: string | null;
  dragging: boolean;
  filtered: boolean;
  renderShift: (s: BoardShift) => React.ReactNode;
  onAdd: (draft: ShiftDraft) => void;
  meId?: string;
}

function DayHeaders({ board, shifts }: { board: Board; shifts: BoardShift[] }) {
  return board.days.map((d) => {
    const l = dayLabel(d);
    const minutes = shifts.filter((s) => s.day === d && s.userId).reduce((a, s) => a + s.paidMinutes, 0);
    return (
      <div key={d} role="columnheader" className="@container border-b border-l px-2 pt-2 pb-1">
        <p className="flex items-baseline justify-between whitespace-nowrap">
          <span><span className="font-numeric text-[26px] leading-none">{l.num}</span> <span className="text-sm font-semibold">{l.dow}</span></span>
          {board.canEdit && <span className="hidden text-xs text-muted-foreground @min-[112px]:inline">{hours(minutes)}</span>}
        </p>
      </div>
    );
  });
}

function PersonHeader({ row, threshold, me }: { row: Row; threshold: number; me: boolean }) {
  const needsOt = row.overtimeMinutes > 0 && !row.overtimeApproved;
  return (
    <div role="rowheader" className={cn("border-b border-l px-2 py-1.5", needsOt && "shadow-[inset_3px_0_0_var(--overtime)]", me && "bg-accent/60")}>
      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
        {row.pos && <span className={cn("h-1.5 w-3 shrink-0 rounded-full", POSITION_BG[row.pos.color])} aria-hidden />}
        {row.name}{me && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
      </p>
      <HoursMeter minutes={row.weekMinutes} threshold={threshold} approved={row.overtimeApproved} className="mt-1" />
      {row.overtimeMinutes > 0 && (
        <p className={cn("text-[11px] font-semibold", needsOt ? "text-overtime" : "text-muted-foreground")}>
          {needsOt ? `${hours(row.overtimeMinutes)} overtime needs approval` : "Overtime approved"}
        </p>
      )}
    </div>
  );
}

export function WeekGrid({ board, shifts, rows, verdicts, overId, dragging, filtered, renderShift, onAdd, meId }: Props) {
  const cell = (userId: string | null, day: string, label: string, children: React.ReactNode, className?: string) => {
    const id = cellId(userId, day);
    const overRow = overId ? parseCell(overId).userId : undefined;
    return (
      <GridCell key={id} id={id} label={label} verdict={verdicts.get(id)} isOver={overId === id} dragging={dragging} showReason={overRow === userId} className={className}
        onAdd={board.canEdit ? () => onAdd({ day, userId }) : undefined}>
        <div className="grid gap-1">{children}</div>
      </GridCell>
    );
  };
  const open = shifts.filter((s) => !s.userId);

  return (
    <div className="overflow-x-auto">
      <div role="grid" aria-label={`${board.location.name} schedule, week of ${weekTitle(board.weekStart)}`}
        className="grid min-w-[860px] grid-cols-[176px_repeat(7,minmax(0,1fr))] border-t border-r">
        <div role="columnheader" className="border-b border-l px-2 py-2">
          <p className="text-sm font-semibold">Team</p>
          <p className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "person" : "people"}, by role</p>
        </div>
        <DayHeaders board={board} shifts={shifts} />

        {board.canEdit && (
          <>
            <div className="border-b border-l px-2 py-1.5">
              <p className="text-xs font-semibold">Coverage</p>
              <p className="text-[11px] text-muted-foreground">people per hour, min {board.rules.minCoverage}</p>
            </div>
            {board.days.map((d) => (
              <div key={d} className="border-b border-l px-2 py-1.5">
                <CoverageStrip hours={board.coverage[d].hours} gaps={board.coverage[d].gaps} min={board.rules.minCoverage} />
              </div>
            ))}
          </>
        )}

        {(board.canEdit || open.length > 0) && (
          <>
            <div className="border-b border-l bg-accent/40 px-2 py-2">
              <p className="text-sm font-semibold">Open shifts</p>
              <p className="text-xs text-muted-foreground">{open.length ? `${open.length} unassigned` : "None"}{board.canEdit && ", drag onto a person"}</p>
            </div>
            {board.days.map((d) => cell(null, d, `Open shifts, ${dayLabel(d).long}`, open.filter((s) => s.day === d).map(renderShift), "bg-accent/40"))}
          </>
        )}

        {rows.map((row) => (
          <div key={row.id} role="row" className="contents">
            <PersonHeader row={row} threshold={board.rules.overtimeThresholdMinutes} me={row.id === meId} />
            {board.days.map((d) => {
              const mine = shifts.filter((s) => s.userId === row.id && s.day === d);
              const off = board.timeOff.some((t) => t.userId === row.id && t.day === d);
              const away = board.elsewhere.filter((e) => e.userId === row.id && e.day === d);
              const blocked = mine.some((s) => s.conflicts.some((c) => c.severity === "block"));
              return cell(row.id, d, `${row.name}, ${dayLabel(d).long}`, (
                <>
                  {off && <p className="rounded-sm border border-dashed px-1 py-2 text-center text-xs font-medium text-muted-foreground">Time off</p>}
                  {mine.map(renderShift)}
                  {away.map((b) => <p key={b.label} className="truncate rounded-sm bg-muted px-1 text-[11px] text-muted-foreground" title={b.label}>Busy: {b.label}</p>)}
                </>
              ), blocked ? "bg-danger-bg" : undefined);
            })}
          </div>
        ))}

        {rows.length === 0 && (
          <div className="col-span-8 border-b border-l p-8 text-center text-sm text-muted-foreground">
            {filtered ? "Nobody matches these filters." : "No one works at this store yet. Add people on the Team page."}
          </div>
        )}
      </div>
    </div>
  );
}
