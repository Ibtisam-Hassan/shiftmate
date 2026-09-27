"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { whenAt } from "@/domain/format";
import type { SwapRow } from "@/server/services/swap-list";
import { cancelSwapAction, respondSwapAction } from "./actions";

export function when(iso: string, tz: string) {
  return whenAt(new Date(iso), tz);
}

function Incoming({ row }: { row: SwapRow }) {
  const [pending, start] = useTransition();
  const answer = (accept: boolean) => start(async () => {
    const res = await respondSwapAction(row.id, accept);
    if (!res.ok) return void toast.error(res.error);
    if (!accept) toast.success("Declined. They get a notice.");
    else if (res.data.status === "APPROVED") toast.success("Done. The shift is yours.");
    else toast.success("Accepted. A manager must approve it because: " + res.data.problems.join(" "));
  });
  const tz = row.shift.timezone;
  return (
    <li className="grid gap-3 overflow-hidden rounded-md border border-l-8 border-l-caution p-4">
      <p className="text-sm font-semibold text-warning">Needs your answer</p>
      <p>
        {row.requester.name} wants you to {row.targetShift ? "trade shifts" : "cover a shift"} at {row.shift.store}.
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded bg-muted p-2"><dt className="text-xs text-muted-foreground">You take</dt><dd className="font-semibold">{when(row.shift.startsAt, tz)}</dd></div>
        {row.targetShift && <div className="rounded bg-muted p-2"><dt className="text-xs text-muted-foreground">You give</dt><dd className="font-semibold">{when(row.targetShift.startsAt, tz)}</dd></div>}
      </dl>
      {row.message && <p className="text-sm text-muted-foreground">&ldquo;{row.message}&rdquo;</p>}
      <div className="grid grid-cols-2 gap-2 sm:w-80">
        <Button variant="outline" className="h-11" disabled={pending} onClick={() => answer(false)}>Decline</Button>
        <Button className="h-11" disabled={pending} onClick={() => answer(true)}>Accept</Button>
      </div>
    </li>
  );
}

function Outgoing({ row }: { row: SwapRow }) {
  const [pending, start] = useTransition();
  const waiting = row.status === "PENDING_COWORKER" ? `Waiting for ${row.target.name.split(" ")[0]}` : "Waiting for a manager";
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
      <span>You offered {when(row.shift.startsAt, row.shift.timezone)} to {row.target.name}. {waiting}.</span>
      <Button size="sm" variant="ghost" disabled={pending}
        onClick={() => start(async () => { const r = await cancelSwapAction(row.id); if (r.ok) toast.success("Offer cancelled."); else toast.error(r.error); })}>
        Cancel offer
      </Button>
    </li>
  );
}

export function SwapInbox({ rows, me }: { rows: SwapRow[]; me: string }) {
  const incoming = rows.filter((r) => r.target.id === me && r.status === "PENDING_COWORKER");
  const outgoing = rows.filter((r) => r.requester.id === me && (r.status === "PENDING_COWORKER" || r.status === "PENDING_MANAGER"));
  if (!incoming.length && !outgoing.length) return null;
  return (
    <section aria-label="Shift swaps" className="grid gap-2">
      <h2 className="font-semibold">Shift swaps</h2>
      <ul className="grid gap-2">
        {incoming.map((r) => <Incoming key={r.id} row={r} />)}
        {outgoing.map((r) => <Outgoing key={r.id} row={r} />)}
      </ul>
    </section>
  );
}
