"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dayName } from "@/domain/format";
import type { Dashboard } from "@/server/services/dashboard";
import { Decide } from "../requests/swap-review";
import { Review } from "../requests/time-off-list";
import { approveOvertimeAction } from "../schedule/actions";
import { hours } from "../schedule/format";

function ApproveOvertime({ item }: { item: Dashboard["overtimeToApprove"][number] }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => {
      const res = await approveOvertimeAction(item.userId, item.weekStart);
      if (res.ok) toast.success(`Approved ${item.name.split(" ")[0]}'s overtime.`); else toast.error(res.error);
    })}>
      {pending && <Loader2 className="animate-spin" />}Approve {hours(item.overtimeMinutes)}
    </Button>
  );
}

/** Decisions only a manager can make, each with its action. Blockers come first. */
export function Waiting({ d }: { d: Dashboard }) {
  const count = d.overtimeToApprove.length + d.pendingTimeOff.length + d.swapsForManager.length;
  if (!count) return <p className="text-sm text-muted-foreground">Nothing waits on you. New requests show up here.</p>;
  return (
    <ul className="grid gap-2">
      {d.overtimeToApprove.map((o) => (
        <li key={o.userId} className="grid gap-2 rounded-md border border-l-4 border-l-overtime p-3">
          <p className="text-sm font-semibold"><span className="mr-1.5 rounded-sm bg-overtime px-1 text-[10px] font-bold text-white">OT</span>Approve {o.name}&apos;s overtime</p>
          <p className="text-xs text-muted-foreground">{hours(o.overtimeMinutes)} over the limit next week. It blocks publishing.</p>
          <ApproveOvertime item={o} />
        </li>
      ))}
      {d.pendingTimeOff.map((r) => (
        <li key={r.id} className="grid gap-2 rounded-md border border-l-4 border-l-warning p-3">
          <p className="text-sm font-semibold">{r.name} asks for {r.from === r.to ? dayName(r.from) : `${dayName(r.from)} to ${dayName(r.to)}`} off</p>
          {r.reason && <p className="text-xs text-muted-foreground">&ldquo;{r.reason}&rdquo;</p>}
          <Review row={r} />
        </li>
      ))}
      {d.swapsForManager.map((s) => (
        <li key={s.id} className="grid gap-2 rounded-md border border-l-4 border-l-warning p-3">
          <p className="text-sm font-semibold">{s.requester.name} and {s.target.name} want to swap</p>
          {s.escalationReason && <p className="text-xs text-muted-foreground">Needs you because: {s.escalationReason}</p>}
          <Decide row={s} />
        </li>
      ))}
    </ul>
  );
}
