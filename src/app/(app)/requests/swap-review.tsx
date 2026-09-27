"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { decideSwapAction } from "@/app/(app)/my-shifts/actions";
import { when } from "@/app/(app)/my-shifts/swap-inbox";
import type { SwapRow } from "@/server/services/swap-list";

const STATUS: Record<string, string> = {
  PENDING_COWORKER: "Waiting for coworker", PENDING_MANAGER: "Waiting for you", APPROVED: "Done",
  REJECTED: "Not approved", CANCELLED: "Cancelled", EXPIRED: "Expired",
};

function Decide({ row }: { row: SwapRow }) {
  const [pending, start] = useTransition();
  const decide = (approve: boolean) => start(async () => {
    const res = await decideSwapAction(row.id, approve);
    if (res.ok) toast.success(approve ? "Approved. The shifts moved and both people get a notice." : "Not approved. Both people get a notice.");
    else toast.error(res.error);
  });
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide(true)}>Approve swap</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(false)}>Do not approve</Button>
    </div>
  );
}

/** Swaps at your stores. Ones that need a manager come first, with the reason. */
export function SwapReview({ rows }: { rows: SwapRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No shift swaps in the last 30 days.</p>;
  const order = (r: SwapRow) => (r.status === "PENDING_MANAGER" ? 0 : 1);
  return (
    <ul className="grid gap-2">
      {[...rows].sort((a, b) => order(a) - order(b)).map((r) => (
        <li key={r.id} className={r.status === "PENDING_MANAGER" ? "grid gap-2 rounded-md border border-l-4 border-l-warning p-3" : "grid gap-1 rounded-md border p-3"}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{r.requester.name}</span>
            <span>{r.targetShift ? "trades with" : "gives a shift to"}</span>
            <span className="font-semibold">{r.target.name}</span>
            <Badge variant="outline">{STATUS[r.status] ?? r.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {r.shift.store}, {when(r.shift.startsAt, r.shift.timezone)}{r.targetShift && ` for ${when(r.targetShift.startsAt, r.shift.timezone)}`}
          </p>
          {r.escalationReason && <p className="text-sm">Why it needs you: {r.escalationReason}</p>}
          {r.status === "PENDING_MANAGER" && <Decide row={r} />}
        </li>
      ))}
    </ul>
  );
}
