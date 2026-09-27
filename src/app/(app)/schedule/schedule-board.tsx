"use client";

import {
  DndContext, type DragEndEvent, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { toast } from "sonner";
import type { Board, BoardShift } from "@/server/services/board";
import { moveShiftAction } from "./actions";
import { BoardToolbar, type Filters } from "./board-toolbar";
import { dragHint, dropTarget, parseCell, verdictsFor } from "./drop-rules";
import { EmptyWeek } from "./empty-week";
import { DayView } from "./day-view";
import { dayLabel, range } from "./format";
import { LaborStrip } from "./labor-strip";
import { ReviewRail, buildItems } from "./review-rail";
import { ShiftDialog, type ShiftDraft } from "./shift-dialog";
import { ShiftSlot } from "./shift-slot";
import { useRows } from "./use-rows";
import { WeekBanner } from "./week-banner";
import { WeekGrid } from "./week-grid";
import { WeekHeader, publishBlocker } from "./week-header";

type Move = { id: string; day: string; userId: string | null };


export function ScheduleBoard({ board, meId }: { board: Board; meId: string }) {
  const isPhone = useMediaQuery("(max-width: 639px)");
  const [shifts, applyMove] = useOptimistic(board.shifts, (state, m: Move) =>
    state.map((s) => (s.id === m.id ? { ...s, day: m.day, userId: m.userId } : s)));
  const [, startMove] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ key: number; shift?: BoardShift; draft?: ShiftDraft } | null>(null);
  const [dragged, setDragged] = useState<BoardShift | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ positionId: null, problemsOnly: false, query: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const rows = useRows(board, shifts, filters);
  const verdicts = useMemo(() => verdictsFor(board, shifts, dragged), [board, shifts, dragged]);
  const live = { ...board, shifts };

  // A new key per open resets the dialog's form to the shift being edited.
  const openDialog = (d: { shift?: BoardShift; draft?: ShiftDraft }) => setDialog((prev) => ({ key: (prev?.key ?? 0) + 1, ...d }));

  const focusShift = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-shift="${id}"] button`);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    el?.focus({ preventScroll: true });
    setPulse(id);
    setTimeout(() => setPulse(null), 1600);
  };
  const { sections, blockCount } = buildItems(
    live,
    (s) => { focusShift(s.id); setSelected(s.id); },
    (day, from, to) => openDialog({ draft: { day, userId: null, startMin: from, endMin: to } }),
  );
  const rail = <ReviewRail sections={sections} blockCount={blockCount} published={board.status === "PUBLISHED"} onFocus={(id) => { setSelected(null); focusShift(id); }} />;

  function onDragEnd(e: DragEndEvent) {
    const s = dragged;
    setDragged(null);
    setOverId(null);
    if (!s || !e.over) return;
    const target = parseCell(String(e.over.id));
    if (target.userId === s.userId && target.day === s.day) return;
    const verdict = verdicts.get(String(e.over.id));
    if (verdict && !verdict.ok) return void toast.error(verdict.reason);
    startMove(async () => {
      applyMove({ id: s.id, ...target });
      const res = await moveShiftAction(s.id, { date: target.day, userId: target.userId });
      if (!res.ok) return void toast.error(res.error);
      const who = board.people.find((p) => p.id === target.userId)?.name ?? "the open shifts";
      toast.success(`Moved to ${who}, ${dayLabel(target.day).long}.`);
    });
  }

  const header = (
    <WeekHeader board={board} shiftCount={shifts.length} blockCount={blockCount} onAddShift={() => openDialog({})} review={rail} />
  );
  if (board.hidden) {
    return (
      <div className="grid gap-4">
        {header}
        <div className="rounded-md border border-dashed p-10 text-center">
          <p className="font-medium">This week is not published yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;ll get a notice here in the app when your manager publishes it.</p>
        </div>
      </div>
    );
  }

  const recipients = new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : []))).size;
  const hint = dragHint(board, dragged, overId);

  return (
    <DndContext id="schedule-dnd" sensors={sensors} collisionDetection={dropTarget}
      onDragStart={(e) => { setSelected(null); setDragged((e.active.data.current as { shift: BoardShift }).shift); }}
      onDragOver={(e) => setOverId(e.over ? String(e.over.id) : null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setDragged(null); setOverId(null); }}
      accessibility={{ screenReaderInstructions: { draggable: "Press space to pick up the shift, arrow keys to move it, space to drop, escape to cancel." } }}>
      <div className="flex gap-4">
        <div className="grid min-w-0 flex-1 gap-3">
          {header}
          <WeekBanner board={board} recipients={recipients} blocker={publishBlocker(board, shifts.length)} />
          {board.canEdit && (
            <a href="#review" className="sr-only rounded bg-card px-3 py-2 focus:not-sr-only focus:w-fit">Skip to the publish review</a>
          )}
          {board.canEdit && !isPhone && <BoardToolbar positions={board.positions} filters={filters} onChange={setFilters} />}
          <LaborStrip board={board} compact={isPhone} />
          {board.canEdit && !shifts.length && <EmptyWeek locationId={board.location.id} weekStart={board.weekStart} onAddShift={() => openDialog({})} />}
          {isPhone ? (
            <DayView board={board} shifts={shifts} rows={rows} meId={meId} onEdit={openDialog} />
          ) : <WeekGrid
            board={board} meId={meId} shifts={shifts} rows={rows} verdicts={verdicts} overId={overId} dragging={!!dragged}
            filtered={!!(filters.query || filters.positionId || filters.problemsOnly)}
            onAdd={(draft) => openDialog({ draft })}
            renderShift={(s) => (
              <ShiftSlot key={s.id} board={live} shift={s} selected={selected === s.id} pulsing={pulse === s.id}
                onSelect={setSelected} onEdit={(x) => { setSelected(null); openDialog({ shift: x }); }} />
            )}
          />}
          {board.canEdit && (
            <p className="text-xs text-muted-foreground">
              <span className="pointer-coarse:hidden">Click a shift for details. Drag it to another person or day, or focus it and press Space, then the arrow keys. Double-click an empty cell to add a shift.</span>
              <span className="hidden pointer-coarse:inline">Tap a shift for details. Use Add shift to add one.</span>
            </p>
          )}
        </div>
        {board.canEdit && <div className="hidden xl:block">{rail}</div>}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && (
          <div className="w-44 rotate-[1.5deg] rounded-md border bg-card p-2 shadow-lg">
            <p className="text-sm font-semibold">{range(dragged.startMin, dragged.endMin)}</p>
            {hint && <p className="mt-1 rounded bg-foreground px-1.5 py-1 text-xs text-background">{hint}</p>}
          </div>
        )}
      </DragOverlay>
      {dialog && <ShiftDialog key={dialog.key} board={board} shift={dialog.shift} draft={dialog.draft} open onOpenChange={(o) => !o && setDialog(null)} />}
    </DndContext>
  );
}
