"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TimeOffRow } from "@/server/services/time-off-list";
import { cancelTimeOffAction, decideTimeOffAction } from "./actions";

const STATUS = {
  PENDING: { label: "Waiting", cls: "border-warning/40 text-warning" },
  APPROVED: { label: "Approved", cls: "border-pos-floor/40 text-pos-floor" },
  DENIED: { label: "Denied", cls: "border-danger/40 text-danger" },
  CANCELLED: { label: "Cancelled", cls: "text-muted-foreground" },
} as const;

const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const range = (r: TimeOffRow) => (r.from === r.to ? nice(r.from) : `${nice(r.from)} to ${nice(r.to)}`);

export function Review({ row }: { row: TimeOffRow }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [openShifts, setOpenShifts] = useState(true);
  const decide = (approve: boolean) => start(async () => {
    const res = await decideTimeOffAction(row.id, { approve, note, openShifts: approve && openShifts });
    if (res.ok) toast.success(approve ? `Approved. ${row.name.split(" ")[0]} gets a notice.` : "Denied.");
    else toast.error(res.error);
  });
  return (
    <div className="grid gap-2">
      {row.affected.length > 0 && (
        <div className="rounded-md bg-muted p-2 text-sm">
          <p className="font-medium">{row.name.split(" ")[0]} already works:</p>
          <ul className="mt-1 grid gap-0.5">
            {row.affected.map((a) => <li key={a.id}><a href={a.href} className="underline underline-offset-2">{a.label}</a></li>)}
          </ul>
        </div>
      )}
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to them (optional)" aria-label="Note" className="h-8 max-w-sm" />
      {row.shiftsInPeriod > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={openShifts} onCheckedChange={(v) => setOpenShifts(!!v)} />
          Also make their {row.shiftsInPeriod} {row.shiftsInPeriod === 1 ? "shift" : "shifts"} in this period open
        </label>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide(true)}>Approve</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(false)}>Deny</Button>
      </div>
    </div>
  );
}

export function TimeOffList({ rows, mode }: { rows: TimeOffRow[]; mode: "mine" | "review" }) {
  const [pending, start] = useTransition();
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">{mode === "mine" ? "You have no time off requests." : "No time off requests from your staff."}</p>;
  }
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id} className={cn("grid gap-2 rounded-md border p-3", r.status === "PENDING" && mode === "review" && "border-l-4 border-l-warning")}>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "review" && <span className="font-semibold">{r.name}</span>}
            <span>{range(r)}</span>
            <Badge variant="outline" className={STATUS[r.status].cls}>{STATUS[r.status].label}</Badge>
          </div>
          {r.reason && <p className="text-sm text-muted-foreground">Reason: {r.reason}</p>}
          {r.reviewNote && <p className="text-sm text-muted-foreground">{r.reviewer ?? "Manager"}: {r.reviewNote}</p>}
          {mode === "review" && r.status === "PENDING" && <Review row={r} />}
          {mode === "mine" && (r.status === "PENDING" || r.status === "APPROVED") && (
            <Button size="sm" variant="ghost" className="w-fit" disabled={pending}
              onClick={() => start(async () => { const res = await cancelTimeOffAction(r.id); if (res.ok) toast.success("Cancelled."); else toast.error(res.error); })}>
              Cancel request
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
