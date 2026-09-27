"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyLastWeekAction } from "./actions";

export function EmptyWeek({ locationId, weekStart, onAddShift }: { locationId: string; weekStart: string; onAddShift: () => void }) {
  const [pending, start] = useTransition();
  const copy = () => start(async () => {
    const res = await copyLastWeekAction(locationId, weekStart);
    if (!res.ok) return void toast.error(res.error);
    const { assigned, opened } = res.data;
    toast.success(`Copied ${assigned + opened} shifts${opened ? `, ${opened} left open` : ""}.`);
  });
  return (
    <div className="mx-auto mt-2 grid max-w-md gap-3 rounded-md border bg-card p-6 text-center shadow-sm">
      <p className="font-numeric text-2xl leading-none">Nothing scheduled yet</p>
      <p className="text-sm text-muted-foreground">
        Start from last week, or add shifts one by one. When you copy, anyone who now has time off or another booking gets an open shift instead.
      </p>
      <div className="flex justify-center gap-2">
        <Button disabled={pending} onClick={copy}>{pending && <Loader2 className="animate-spin" />}Copy last week</Button>
        <Button variant="outline" onClick={onAddShift}>Add a shift</Button>
      </div>
    </div>
  );
}
