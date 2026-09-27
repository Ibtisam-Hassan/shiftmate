"use client";

import { Loader2, TriangleAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { Board, BoardShift } from "@/server/services/board";
import { deleteShiftAction, keepAnywayAction, makeOpenAction } from "./actions";
import { AssignPanel } from "./assign-panel";
import { POSITION_BG, dayLabel, hours, range, trackPosition } from "./format";
import { HoursMeter } from "./hours-meter";

function KeepAnyway({ shiftId, kind }: { shiftId: string; kind: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Keep anyway…</Button>;
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await keepAnywayAction(shiftId, kind, reason);
          if (res.ok) toast.success("Kept. The reason is saved with the shift.");
          else toast.error(res.fieldErrors?.reason ?? res.error);
        });
      }}
    >
      <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? e.g. they asked for it" aria-label="Reason for keeping" className="h-8" />
      <Button size="sm" type="submit" disabled={pending || reason.trim().length < 3}>{pending && <Loader2 className="animate-spin" />}Keep</Button>
    </form>
  );
}

export function ShiftDetails({ board, shift, onEdit, onClose }: {
  board: Board; shift: BoardShift; onEdit: () => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"details" | "assign">("details");
  const [pending, start] = useTransition();
  const person = board.people.find((p) => p.id === shift.userId);
  const position = board.positions.find((p) => p.id === shift.positionId);
  const { left, width } = trackPosition(shift.startMin, shift.endMin);
  const title = range(shift.startMin, shift.endMin);

  if (mode === "assign") {
    return <AssignPanel shiftId={shift.id} title={`${person ? "Reassign" : "Assign"} ${title}`} threshold={board.rules.overtimeThresholdMinutes} onDone={onClose} />;
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(done); onClose(); } else toast.error(res.error);
    });

  return (
    <div className="grid gap-3">
      <div>
        <p className="font-numeric text-[26px] leading-none">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{person?.name ?? "Open shift"} · {dayLabel(shift.day).long}</p>
      </div>
      <div className="relative h-2 rounded-full bg-track" aria-hidden>
        <div className={cn("absolute inset-y-0 rounded-full", POSITION_BG[position?.color ?? ""] ?? "bg-muted-foreground")} style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Position</dt><dd>{position?.name ?? "None"}</dd>
        <dt className="text-muted-foreground">Break</dt><dd>{shift.breakMinutes ? `${shift.breakMinutes} min unpaid` : "None"}</dd>
        <dt className="text-muted-foreground">Paid</dt>
        <dd>{hours(shift.paidMinutes)}{shift.costCents != null && `, ${formatCents(shift.costCents)}`}{shift.overtimeMinutes > 0 && <span className="text-overtime"> ({hours(shift.overtimeMinutes)} OT)</span>}</dd>
      </dl>
      {person && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{person.name.split(" ")[0]}&apos;s week, all stores</p>
          <HoursMeter minutes={person.weekMinutes} threshold={board.rules.overtimeThresholdMinutes} approved={person.overtimeApproved} />
        </div>
      )}
      {shift.notes && <p className="rounded-md bg-muted p-2 text-sm">{shift.notes}</p>}
      {shift.conflicts.length > 0 && (
        <ul className="grid gap-2">
          {shift.conflicts.map((c) => (
            <li key={c.kind + (c.relatedShiftId ?? "")} className={cn("grid gap-2 rounded-md border-l-4 p-2 text-sm", c.severity === "block" ? "border-danger bg-danger-bg" : c.overridden ? "border-border bg-muted" : "border-warning bg-warning-bg")}>
              <p className="flex gap-1.5">
                {c.severity === "block" ? <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
                <span>{c.detail}{c.overridden && " Kept anyway."}{c.severity === "block" && " This blocks publishing."}</span>
              </p>
              {board.canEdit && c.severity === "warn" && !c.overridden && <KeepAnyway shiftId={shift.id} kind={c.kind} />}
            </li>
          ))}
        </ul>
      )}
      {board.canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("assign")}>{person ? "Reassign…" : "Assign…"}</Button>
          {person && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => makeOpenAction(shift.id), "It's an open shift now.")}>Make open</Button>}
          <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger-bg hover:text-danger" disabled={pending}
            onClick={() => run(() => deleteShiftAction(shift.id), "Shift deleted.")}>Delete</Button>
        </div>
      )}
    </div>
  );
}
