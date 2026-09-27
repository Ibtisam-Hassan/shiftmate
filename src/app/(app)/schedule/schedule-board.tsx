"use client";

import {
  type CollisionDetection, DndContext, type DragEndEvent, type DragOverEvent, type DragStartEvent, DragOverlay, KeyboardSensor, PointerSensor,
  pointerWithin, rectIntersection, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, ListChecks, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatCents } from "@/domain/pay";
import { addDays } from "@/domain/time";
import { cn } from "@/lib/utils";
import type { Board, BoardShift, Busy } from "@/server/services/board";
import { copyLastWeekAction, moveShiftAction, publishWeekAction } from "./actions";
import { CoverageStrip } from "./coverage-strip";
import { POSITION_BG, dayLabel, hours, range, weekTitle } from "./format";
import { HoursMeter } from "./hours-meter";
import { ReviewRail, buildItems } from "./review-rail";
import { ShiftBar } from "./shift-bar";
import { ShiftDetails } from "./shift-details";
import { ShiftDialog, type ShiftDraft } from "./shift-dialog";

const OPEN_ROW = "open";

// Drop where the pointer is, not where the (offset) drag card overlaps most. Keyboard drags have
// no pointer, so they fall back to overlap.
const dropTarget: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};
const cellId = (userId: string | null, day: string) => `${userId ?? OPEN_ROW}|${day}`;
const parseCell = (id: string) => {
  const [u, day] = id.split("|");
  return { userId: u === OPEN_ROW ? null : u, day };
};
const overlapsMin = (a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) => a.startMin < b.endMin && b.startMin < a.endMin;

type Verdict = { ok: true; warn?: string } | { ok: false; reason: string };

/** Mirrors the server's rules so the grid can mark drop targets before the drop. The server re-checks. */
function judgeDrop(board: Board, shifts: BoardShift[], s: BoardShift, target: { userId: string | null; day: string }): Verdict {
  if (!target.userId) return { ok: true };
  const moved = { startMin: s.startMin, endMin: s.endMin };
  const busyHere = shifts.find((x) => x.id !== s.id && x.userId === target.userId && x.day === target.day && overlapsMin(x, moved));
  if (busyHere) return { ok: false, reason: `Busy ${range(busyHere.startMin, busyHere.endMin)}` };
  const away = board.elsewhere.find((e) => e.userId === target.userId && e.day === target.day && overlapsMin(e, moved));
  if (away) return { ok: false, reason: `Busy: ${away.label}` };
  if (board.timeOff.some((t) => t.userId === target.userId && t.day === target.day)) return { ok: true, warn: "Time off" };
  if (board.unavailable.some((u) => u.userId === target.userId && u.day === target.day && overlapsMin(u, moved))) return { ok: true, warn: "Unavailable" };
  return { ok: true };
}

function Cell({ id, children, verdict, isOver, dragging, onAdd, className, label }: {
  id: string; children: React.ReactNode; verdict?: Verdict; isOver: boolean; dragging: boolean; onAdd?: () => void; className?: string; label: string;
}) {
  const { setNodeRef } = useDroppable({ id, disabled: verdict?.ok === false });
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      onDoubleClick={onAdd}
      className={cn(
        "@container group/cell relative min-h-[46px] border-b border-l px-2 py-1.5 transition-colors",
        dragging && verdict?.ok && "bg-ring/[0.09] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ring)_55%,transparent)]",
        dragging && verdict?.ok && isOver && "bg-ring/[0.16] shadow-[inset_0_0_0_2px_var(--ring)]",
        dragging && verdict?.ok === false && "bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,var(--card)_6px_12px)]",
        className,
      )}
    >
      {children}
      {dragging && verdict && (verdict.ok === false || verdict.warn) && (
        <span className={cn("absolute right-1.5 bottom-1 text-[10.5px] font-semibold", verdict.ok ? "text-warning" : "text-muted-foreground")}>
          {verdict.ok ? `⚠ ${verdict.warn}` : `⊘ ${verdict.reason}`}
        </span>
      )}
      {onAdd && !dragging && (
        <button type="button" onClick={onAdd} aria-label={`Add shift, ${label}`}
          className="absolute right-1 bottom-1 grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/cell:opacity-100 hover:bg-accent focus-visible:opacity-100">
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, sub, className }: { label: string; value: string; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-r px-3 py-2 first:pl-0 last:border-r-0", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-numeric text-[28px] leading-none">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Delta({ now, before, fmt }: { now: number; before?: number; fmt: (n: number) => string }) {
  if (before === undefined) return null;
  const d = now - before;
  if (Math.abs(d) < 1) return <>same as last week</>;
  return <>{d > 0 ? "▲" : "▼"} {fmt(Math.abs(d))} vs last week</>;
}

export function ScheduleBoard({ board }: { board: Board }) {
  const [shifts, applyMove] = useOptimistic(board.shifts, (state, m: { id: string; day: string; userId: string | null }) =>
    state.map((s) => (s.id === m.id ? { ...s, day: m.day, userId: m.userId } : s)));
  const [, startMove] = useTransition();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ key: number; shift?: BoardShift; draft?: ShiftDraft } | null>(null);
  const [activeShift, setActiveShift] = useState<BoardShift | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [q, setQ] = useState("");
  const [pulse, setPulse] = useState<string | null>(null);
  // Each dialog open gets a fresh key so its form state starts from the new shift.
  const openDialog = (d: { shift?: BoardShift; draft?: ShiftDraft }) => setDialog((prev) => ({ key: (prev?.key ?? 0) + 1, ...d }));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const threshold = board.rules.overtimeThresholdMinutes;
  const posById = useMemo(() => new Map(board.positions.map((p) => [p.id, p])), [board.positions]);

  // Rows: people grouped by the position they work most this week, then by name.
  const rows = useMemo(() => {
    const order = ["Supervisor", "Cashier", "Stock", "Floor"];
    const main = (id: string) => {
      const counts = new Map<string, number>();
      for (const s of shifts) if (s.userId === id && s.positionId) counts.set(s.positionId, (counts.get(s.positionId) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return top ? posById.get(top) : undefined;
    };
    const needle = q.trim().toLowerCase();
    return board.people
      .map((p) => ({ ...p, pos: main(p.id), problems: shifts.some((s) => s.userId === p.id && s.conflicts.some((c) => !c.overridden)) || (p.overtimeMinutes > 0 && !p.overtimeApproved) }))
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .filter((p) => !posFilter || p.pos?.id === posFilter)
      .filter((p) => !problemsOnly || p.problems)
      .sort((a, b) => {
        const ia = a.pos ? order.indexOf(a.pos.name) : 99;
        const ib = b.pos ? order.indexOf(b.pos.name) : 99;
        return (ia < 0 ? 50 : ia) - (ib < 0 ? 50 : ib) || a.name.localeCompare(b.name);
      });
  }, [board.people, shifts, q, posFilter, problemsOnly, posById]);

  const focusShift = (id: string) => {
    setSelected(null);
    const el = document.querySelector<HTMLElement>(`[data-shift="${id}"] button`);
    el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
    setPulse(id);
    setTimeout(() => setPulse(null), 1600);
  };
  const { sections, blockCount } = buildItems(board, (s) => { focusShift(s.id); setSelected(s.id); },
    (day, from, to) => openDialog({ draft: { day, userId: null, startMin: from, endMin: to } }));

  const verdicts = useMemo(() => {
    if (!activeShift) return new Map<string, Verdict>();
    const m = new Map<string, Verdict>();
    for (const day of board.days) {
      m.set(cellId(null, day), { ok: true });
      for (const p of board.people) m.set(cellId(p.id, day), judgeDrop(board, shifts, activeShift, { userId: p.id, day }));
    }
    return m;
  }, [activeShift, board, shifts]);

  const hint = (() => {
    if (!activeShift || !overId) return null;
    const t = parseCell(overId);
    if (!t.userId || t.userId === activeShift.userId) return null;
    const p = board.people.find((x) => x.id === t.userId);
    if (!p) return null;
    const after = p.weekMinutes + activeShift.paidMinutes;
    const ot = Math.max(0, after - threshold) - Math.max(0, p.weekMinutes - threshold);
    return `${p.name.split(" ")[0]}: ${hours(p.weekMinutes)} → ${hours(after)}${ot > 0 ? `, +${hours(ot)} overtime` : ""}`;
  })();

  function onDragStart(e: DragStartEvent) {
    setSelected(null);
    setActiveShift((e.active.data.current as { shift: BoardShift }).shift);
  }
  function onDragOver(e: DragOverEvent) {
    setOverId(e.over ? String(e.over.id) : null);
  }
  function onDragEnd(e: DragEndEvent) {
    const s = activeShift;
    setActiveShift(null);
    setOverId(null);
    if (!s || !e.over) return;
    const target = parseCell(String(e.over.id));
    if (target.userId === s.userId && target.day === s.day) return;
    const verdict = verdicts.get(String(e.over.id));
    if (verdict && !verdict.ok) { toast.error(verdict.reason); return; }
    startMove(async () => {
      applyMove({ id: s.id, ...target });
      const res = await moveShiftAction(s.id, { date: target.day, userId: target.userId });
      if (res.ok) {
        const who = board.people.find((p) => p.id === target.userId)?.name ?? "the open shifts";
        toast.success(`Moved to ${who}, ${dayLabel(target.day).long}.`);
      } else toast.error(res.error);
    });
  }

  const recipients = new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : []))).size;
  const todo = [
    board.blockers.conflicts && `fix ${board.blockers.conflicts} double-booked shift${board.blockers.conflicts > 1 ? "s" : ""}`,
    board.blockers.overtime.length && `approve overtime for ${board.blockers.overtime.length} ${board.blockers.overtime.length > 1 ? "people" : "person"}`,
  ].filter(Boolean);
  const publishReason = !shifts.length ? "Add shifts to publish." : todo.length ? `Can't publish yet: ${todo.join(" and ")}.` : null;

  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="font-numeric text-4xl leading-none">Week of {weekTitle(board.weekStart)}</h1>
      <div className="flex items-center gap-1">
        <Button asChild size="icon" variant="outline" className="size-8" aria-label="Previous week">
          <Link href={`?store=${board.location.id}&week=${addDays(board.weekStart, -7)}`}><ChevronLeft /></Link>
        </Button>
        <Button asChild size="icon" variant="outline" className="size-8" aria-label="Next week">
          <Link href={`?store=${board.location.id}&week=${addDays(board.weekStart, 7)}`}><ChevronRight /></Link>
        </Button>
        {board.weekStart !== board.thisWeek && (
          <Button asChild size="sm" variant="outline"><Link href={`?store=${board.location.id}`}>This week</Link></Button>
        )}
      </div>
      {board.locations.length > 1 && (
        <nav aria-label="Store" className="flex rounded-md bg-muted p-0.5">
          {board.locations.map((l) => (
            <Link key={l.id} href={`?store=${l.id}&week=${board.weekStart}`} aria-current={l.id === board.location.id ? "page" : undefined}
              className={cn("rounded px-3 py-1 text-sm font-medium text-muted-foreground", l.id === board.location.id && "bg-card text-foreground shadow-sm")}>
              {l.name}
            </Link>
          ))}
        </nav>
      )}
      {board.canEdit && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openDialog({})}><Plus /> Add shift</Button>
          {publishReason && <p className="max-w-64 text-right text-xs text-danger">{publishReason}</p>}
          <Button
            disabled={!!publishReason || pending}
            onClick={() => start(async () => {
              const res = await publishWeekAction(board.location.id, board.weekStart);
              if (res.ok) toast.success(`Published. ${res.data.notified} people were notified in the app.`);
              else toast.error(res.error);
            })}
          >
            {pending && <Loader2 className="animate-spin" />}
            {board.status === "PUBLISHED" ? "Publish again" : "Publish week"}
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="xl:hidden"><ListChecks /> Review{blockCount ? ` (${blockCount})` : ""}</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] overflow-y-auto p-0">
              <SheetTitle className="sr-only">Publish review</SheetTitle>
              <ReviewRail sections={sections} blockCount={blockCount} onFocus={focusShift} />
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );

  if (board.hidden) {
    return (
      <div className="grid gap-4">
        {header}
        <div className="rounded-md border border-dashed p-10 text-center">
          <p className="font-medium">This week isn&apos;t published yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;ll get a notice here in the app when your manager publishes it.</p>
        </div>
      </div>
    );
  }

  const banner = board.canEdit && (
    board.status === "PUBLISHED" ? (
      <div className="flex items-center gap-3 rounded-md bg-accent/60 px-3 py-2 text-sm">
        <span><span className="font-semibold">Published</span> {board.publishedAt && new Date(board.publishedAt).toLocaleString("en-US", { timeZone: board.location.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Changes send an in-app update to the people affected.</span>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-3 overflow-hidden rounded-md bg-warning-bg py-2 pr-3 text-sm">
        <span className="caution-tape w-3 self-stretch" aria-hidden />
        <span><span className="font-semibold">Draft.</span> Staff can&apos;t see this week until you publish. Publishing notifies {recipients} {recipients === 1 ? "person" : "people"} in the app.</span>
      </div>
    )
  );

  const labor = board.labor;
  const budget = board.location.weeklyBudgetCents;
  const laborStrip = labor && (
    <div className="flex flex-wrap items-stretch border-y py-1">
      <Stat label="Scheduled" value={hours(labor.scheduledMinutes)} sub={<Delta now={labor.scheduledMinutes} before={labor.lastWeek?.scheduledMinutes} fmt={(n) => hours(n)} />} />
      <Stat label="Regular pay" value={formatCents(labor.regularCents, { compact: true })} />
      <Stat label={`Overtime pay (${hours(labor.overtimeMinutes)} × ${board.rules.overtimeMultiplierPercent / 100})`} value={formatCents(labor.overtimeCents, { compact: true })} className={labor.overtimeCents ? "[&_p:nth-child(2)]:text-overtime" : ""} />
      <Stat label="Total labor" value={formatCents(labor.totalCents, { compact: true })} sub={<Delta now={labor.totalCents} before={labor.lastWeek?.totalCents} fmt={(n) => formatCents(n, { compact: true })} />} />
      {budget ? (
        <div className="min-w-64 flex-1 px-3 py-2">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{board.location.name} weekly budget {formatCents(budget, { compact: true })}</span>
            <span className={cn("font-semibold", labor.totalCents > budget && "text-danger")}>{labor.totalCents > budget ? `${formatCents(labor.totalCents - budget, { compact: true })} over` : `${formatCents(budget - labor.totalCents, { compact: true })} left`}</span></div>
          <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-track" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={labor.totalCents} aria-label="Budget used">
            <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${Math.min(100, (labor.regularCents / budget) * 100)}%` }} />
            <div className="absolute inset-y-0 bg-[repeating-linear-gradient(-45deg,var(--overtime)_0_3px,color-mix(in_oklab,var(--overtime)_55%,transparent)_3px_6px)]"
              style={{ left: `${Math.min(100, (labor.regularCents / budget) * 100)}%`, width: `${Math.min(100, (labor.overtimeCents / budget) * 100)}%` }} />
          </div>
          <p className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Regular {Math.round((labor.regularCents / budget) * 100)}% · Overtime {((labor.overtimeCents / budget) * 100).toFixed(1)}%</span>
            <span>{Math.round((labor.totalCents / budget) * 100)}% used</span>
          </p>
          {labor.unpricedShifts > 0 && <p className="text-xs text-warning">{labor.unpricedShifts} shifts have no pay rate and aren&apos;t counted.</p>}
        </div>
      ) : null}
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Show</span>
      {[{ id: null, name: "Everyone", color: "" }, ...board.positions].map((p) => (
        <button key={p.id ?? "all"} type="button" aria-pressed={posFilter === p.id} onClick={() => setPosFilter(p.id)}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm", posFilter === p.id ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}>
          {p.color && <span className={cn("h-1.5 w-3 rounded-full", POSITION_BG[p.color])} aria-hidden />}{p.name}
        </button>
      ))}
      {board.canEdit && (
        <label className="ml-2 flex items-center gap-2 text-sm"><Switch checked={problemsOnly} onCheckedChange={setProblemsOnly} />Problems only</label>
      )}
      <div className="relative ml-auto w-48">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" className="h-8 pl-8" aria-label="Find a person" />
      </div>
    </div>
  );

  const openShifts = shifts.filter((s) => !s.userId);
  const dragging = !!activeShift;

  function renderShift(s: BoardShift) {
    const selectedNow = selected === s.id;
    return (
      <div key={s.id} data-shift={s.id} className={cn("rounded-[5px]", pulse === s.id && "ring-2 ring-ring motion-safe:animate-pulse")}>
        <Popover open={selectedNow} onOpenChange={(o) => setSelected(o ? s.id : null)}>
          <PopoverAnchor asChild>
            <div>
              <ShiftBar shift={s} position={s.positionId ? posById.get(s.positionId) : undefined} draggable={board.canEdit} selected={selectedNow} onOpen={() => setSelected(s.id)} />
            </div>
          </PopoverAnchor>
          <PopoverContent className="w-[340px]" align="start" side="right" collisionPadding={12}>
            <ShiftDetails board={{ ...board, shifts }} shift={s} onEdit={() => { setSelected(null); openDialog({ shift: s }); }} onClose={() => setSelected(null)} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  function busyBadges(list: Busy[]) {
    return list.map((b, i) => (
      <p key={i} className="truncate rounded-sm bg-muted px-1 text-[11px] text-muted-foreground" title={b.label}>
        {b.label.startsWith("Unavailable") ? b.label : `Busy: ${b.label}`}
      </p>
    ));
  }

  const grid = (
    <div className="overflow-x-auto">
      <div role="grid" aria-label={`${board.location.name} schedule, week of ${weekTitle(board.weekStart)}`} className="grid min-w-[860px] grid-cols-[176px_repeat(7,minmax(0,1fr))] border-t border-r">
        <div role="columnheader" className="border-b border-l px-2 py-2">
          <p className="text-sm font-semibold">Team</p>
          <p className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "person" : "people"}, by role</p>
        </div>
        {board.days.map((d) => {
          const dayMinutes = shifts.filter((s) => s.day === d && s.userId).reduce((a, s) => a + s.paidMinutes, 0);
          const l = dayLabel(d);
          return (
            <div key={d} role="columnheader" className="@container border-b border-l px-2 pt-2 pb-1">
              <p className="flex items-baseline justify-between whitespace-nowrap"><span><span className="font-numeric text-[26px] leading-none">{l.num}</span> <span className="text-sm font-semibold">{l.dow}</span></span><span className="hidden text-xs text-muted-foreground @min-[112px]:inline">{hours(dayMinutes)}</span></p>
            </div>
          );
        })}
        {board.canEdit && (
          <>
            <div className="border-b border-l px-2 py-1.5"><p className="text-xs font-semibold">Coverage</p><p className="text-[11px] text-muted-foreground">people per hour, min {board.rules.minCoverage}</p></div>
            {board.days.map((d) => (
              <div key={d} className="border-b border-l px-2 py-1.5"><CoverageStrip hours={board.coverage[d].hours} gaps={board.coverage[d].gaps} min={board.rules.minCoverage} /></div>
            ))}
          </>
        )}
        {(board.canEdit || openShifts.length > 0) && (
          <>
            <div className="border-b border-l bg-accent/40 px-2 py-2">
              <p className="text-sm font-semibold">Open shifts</p>
              <p className="text-xs text-muted-foreground">{openShifts.length ? `${openShifts.length} unassigned` : "None"}{board.canEdit && ", drag onto a person"}</p>
            </div>
            {board.days.map((d) => (
              <Cell key={d} id={cellId(null, d)} label={`Open shifts, ${dayLabel(d).long}`} verdict={verdicts.get(cellId(null, d))} isOver={overId === cellId(null, d)} dragging={dragging}
                onAdd={board.canEdit ? () => openDialog({ draft: { day: d, userId: null } }) : undefined} className="bg-accent/40">
                <div className="grid gap-1">{openShifts.filter((s) => s.day === d).map(renderShift)}</div>
              </Cell>
            ))}
          </>
        )}
        {rows.map((p) => (
          <div key={p.id} role="row" className="contents">
            <div role="rowheader" className={cn("border-b border-l px-2 py-1.5", p.overtimeMinutes > 0 && !p.overtimeApproved && "shadow-[inset_3px_0_0_var(--overtime)]")}>
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {p.pos && <span className={cn("h-1.5 w-3 shrink-0 rounded-full", POSITION_BG[p.pos.color])} aria-hidden />}{p.name}
              </p>
              <HoursMeter minutes={p.weekMinutes} threshold={threshold} approved={p.overtimeApproved} className="mt-1" />
              {p.overtimeMinutes > 0 && (
                <p className={cn("text-[11px] font-semibold", p.overtimeApproved ? "text-muted-foreground" : "text-overtime")}>
                  {p.overtimeApproved ? "Overtime approved" : `${hours(p.overtimeMinutes)} overtime needs approval`}
                </p>
              )}
            </div>
            {board.days.map((d) => {
              const id = cellId(p.id, d);
              const off = board.timeOff.some((t) => t.userId === p.id && t.day === d);
              const mine = shifts.filter((s) => s.userId === p.id && s.day === d);
              const blocked = mine.some((s) => s.conflicts.some((c) => c.severity === "block"));
              return (
                <Cell key={d} id={id} label={`${p.name}, ${dayLabel(d).long}`} verdict={verdicts.get(id)} isOver={overId === id} dragging={dragging}
                  onAdd={board.canEdit ? () => openDialog({ draft: { day: d, userId: p.id } }) : undefined}
                  className={cn(blocked && "bg-danger-bg")}>
                  <div className="grid gap-1">
                    {off && <p className="rounded-sm border border-dashed px-1 py-2 text-center text-xs font-medium text-muted-foreground">Time off</p>}
                    {mine.map(renderShift)}
                    {busyBadges(board.elsewhere.filter((e) => e.userId === p.id && e.day === d))}
                  </div>
                </Cell>
              );
            })}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="col-span-8 border-b border-l p-8 text-center text-sm text-muted-foreground">
            {q || posFilter || problemsOnly ? "Nobody matches these filters." : "No one works at this store yet. Add people on the Team page."}
          </div>
        )}
      </div>
    </div>
  );

  const empty = board.canEdit && shifts.length === 0 && (
    <div className="mx-auto mt-2 grid max-w-md gap-3 rounded-md border bg-card p-6 text-center shadow-sm">
      <p className="font-numeric text-2xl leading-none">Nothing scheduled yet</p>
      <p className="text-sm text-muted-foreground">Start from last week (people who now have time off or another booking become open shifts), or add shifts one by one.</p>
      <div className="flex justify-center gap-2">
        <Button disabled={pending} onClick={() => start(async () => {
          const res = await copyLastWeekAction(board.location.id, board.weekStart);
          if (res.ok) toast.success(`Copied ${res.data.assigned + res.data.opened} shifts${res.data.opened ? `, ${res.data.opened} left open` : ""}.`);
          else toast.error(res.error);
        })}>{pending && <Loader2 className="animate-spin" />}Copy last week</Button>
        <Button variant="outline" onClick={() => openDialog({})}>Add a shift</Button>
      </div>
    </div>
  );

  return (
    <DndContext id="schedule-dnd" sensors={sensors} collisionDetection={dropTarget} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveShift(null); setOverId(null); }}
      accessibility={{ screenReaderInstructions: { draggable: "Press space to pick up the shift, use arrow keys to move it, space to drop, escape to cancel." } }}>
      <div className="flex gap-4">
        <div className="grid min-w-0 flex-1 gap-3">
          {header}
          {banner}
          {board.canEdit && toolbar}
          {laborStrip}
          {empty}
          {grid}
          {board.canEdit && (
            <p className="text-xs text-muted-foreground">
              Click a shift for details. Drag it to another person or day, or focus it and press Space, then the arrow keys. Double-click an empty cell to add a shift.
            </p>
          )}
        </div>
        {board.canEdit && <div className="hidden xl:block"><ReviewRail sections={sections} blockCount={blockCount} onFocus={focusShift} /></div>}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeShift && (
          <div className="w-44 rotate-[1.5deg] rounded-md border bg-card p-2 shadow-lg">
            <p className="text-sm font-semibold">{range(activeShift.startMin, activeShift.endMin)}</p>
            {hint && <p className="mt-1 rounded bg-foreground px-1.5 py-1 text-xs text-background">{hint}</p>}
          </div>
        )}
      </DragOverlay>
      {dialog && <ShiftDialog key={dialog.key} board={board} shift={dialog.shift} draft={dialog.draft} open onOpenChange={(o) => !o && setDialog(null)} />}
    </DndContext>
  );
}
