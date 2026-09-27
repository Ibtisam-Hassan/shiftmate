"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Candidate, Excluded } from "@/domain/assign";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import { assignShiftAction, candidatesAction } from "./actions";
import { hours } from "./format";
import { HoursMeter } from "./hours-meter";

export function AssignPanel({ shiftId, title, threshold, onDone }: {
  shiftId: string; title: string; threshold: number; onDone: () => void;
}) {
  const [data, setData] = useState<{ ranked: Candidate[]; excluded: Excluded[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    candidatesAction(shiftId).then((res) => {
      if (!live) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => { live = false; };
  }, [shiftId]);

  return (
    <div className="grid gap-3">
      <div>
        <p className="font-numeric text-2xl leading-none">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">Best first: no added overtime, enough rest, not already working that day, lowest cost.</p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!data && !error && (
        <div className="grid gap-2" aria-busy>
          {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />)}
        </div>
      )}
      {data && data.ranked.length === 0 && <p className="text-sm text-muted-foreground">Nobody at this store is free for this shift.</p>}
      {data && (
        <ol className="grid gap-2">
          {data.ranked.slice(0, 4).map((c, i) => (
            <li key={c.userId} className={cn("grid gap-1.5 rounded-md border p-2.5", i === 0 && "border-primary/40 bg-accent/40")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-baseline gap-2">
                  <span className="font-numeric text-lg leading-none text-muted-foreground">{i + 1}</span>
                  <span className="font-medium">{c.name}</span>
                </span>
                <Button
                  size="sm" variant={i === 0 ? "default" : "outline"} disabled={pending}
                  onClick={() => { setWhich(c.userId); start(async () => {
                    const res = await assignShiftAction(shiftId, c.userId);
                    if (res.ok) { toast.success(`Assigned to ${c.name}.`); onDone(); } else toast.error(res.error);
                  }); }}
                >
                  {pending && which === c.userId && <Loader2 className="animate-spin" />}Assign
                </Button>
              </div>
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {c.addedOvertimeMinutes > 0 ? <span className="font-semibold text-overtime">+{hours(c.addedOvertimeMinutes)} overtime</span> : <span>No overtime</span>}
                {c.shortRest && <span className="font-semibold text-warning">Short rest</span>}
                <span>{c.worksThatDay ? "Already working that day" : "Free that day"}</span>
                {c.addedCostCents != null && <span>+{formatCents(c.addedCostCents, { compact: true })}</span>}
              </p>
              <HoursMeter minutes={c.beforeMinutes} after={c.afterMinutes} threshold={threshold} />
            </li>
          ))}
        </ol>
      )}
      {data && data.excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Not suggested: </span>
          {data.excluded.map((e) => `${e.name.split(" ")[0]} (${e.reason.toLowerCase()})`).join(", ")}.
        </p>
      )}
    </div>
  );
}
