"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Board, BoardShift } from "@/server/services/board";
import { createShiftAction, updateShiftAction } from "./actions";
import { dayLabel, hhmm } from "./format";

const OPEN = "__open__";

export interface ShiftDraft { day: string; userId: string | null; startMin?: number; endMin?: number }

export function ShiftDialog({ board, shift, draft, open, onOpenChange }: {
  board: Board; shift?: BoardShift; draft?: ShiftDraft; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const init = shift ?? { day: draft?.day ?? board.days[0], userId: draft?.userId ?? null, startMin: draft?.startMin ?? 540, endMin: draft?.endMin ?? 1020, positionId: board.positions[0]?.id ?? null, breakMinutes: 30, notes: "" };
  const [day, setDay] = useState(init.day);
  const [userId, setUserId] = useState(init.userId ?? OPEN);
  const [positionId, setPositionId] = useState(init.positionId ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? "Edit shift" : "Add shift"}</DialogTitle>
          <DialogDescription>
            {board.status === "PUBLISHED" ? "This week is published: the people affected get an in-app update." : "Staff see it once you publish."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(form) => start(async () => {
            setErrors({});
            const input = {
              date: day, start: String(form.get("start")), end: String(form.get("end")),
              userId: userId === OPEN ? null : userId, positionId: positionId || null,
              breakMinutes: Number(form.get("breakMinutes") ?? 0), notes: String(form.get("notes") ?? ""),
            };
            const res = shift ? await updateShiftAction(shift.id, input) : await createShiftAction(board.location.id, input);
            if (res.ok) { toast.success(shift ? "Shift saved." : "Shift added."); onOpenChange(false); }
            else { setErrors(res.fieldErrors ?? {}); toast.error(res.error); }
          })}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sd-day">Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger id="sd-day" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{board.days.map((d) => <SelectItem key={d} value={d}>{dayLabel(d).long}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sd-pos">Position</Label>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger id="sd-pos" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{board.positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sd-start">Starts</Label>
              <Input id="sd-start" name="start" type="time" step={900} defaultValue={hhmm(init.startMin)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sd-end">Ends</Label>
              <Input id="sd-end" name="end" type="time" step={900} defaultValue={hhmm(init.endMin)} required aria-describedby="sd-end-hint" />
              {errors.end ? <p className="text-xs text-danger">{errors.end}</p> : <p id="sd-end-hint" className="text-xs text-muted-foreground">Earlier than the start = next day.</p>}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sd-user">Person</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="sd-user" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={OPEN}>Open shift (nobody yet)</SelectItem>
                {board.people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sd-break">Unpaid break (min)</Label>
              <Input id="sd-break" name="breakMinutes" type="number" min={0} max={120} step={5} defaultValue={init.breakMinutes} />
              {errors.breakMinutes && <p className="text-xs text-danger">{errors.breakMinutes}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sd-notes">Notes (optional)</Label>
              <Textarea id="sd-notes" name="notes" rows={1} maxLength={300} defaultValue={init.notes ?? ""} className="min-h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{shift ? "Save shift" : "Add shift"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
