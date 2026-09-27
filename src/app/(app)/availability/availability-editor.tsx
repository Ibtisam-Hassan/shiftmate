"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clockTime, compactRange, dayName } from "@/domain/format";
import type { UnavailableWindow } from "@/server/services/availability";
import { saveAvailabilityAction } from "./actions";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DOW = [1, 2, 3, 4, 5, 6, 0];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

function describe(w: UnavailableWindow) {
  if (w.startMinute === 0 && w.endMinute === 1440) return "All day";
  return `${clockTime(w.startMinute)} to ${w.endMinute === 1440 ? "end of day" : clockTime(w.endMinute)}`;
}

type Upcoming = { id: string; day: string; startMin: number; endMin: number; store: string };

export function AvailabilityEditor({ initial, shifts }: { initial: UnavailableWindow[]; shifts: Upcoming[] }) {
  const [windows, setWindows] = useState(initial);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ day: number; from: string; to: string } | null>(null);
  const dirty = JSON.stringify(windows) !== JSON.stringify(initial);

  const add = (w: UnavailableWindow) => setWindows((ws) => [...ws, w].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute));
  const save = () => start(async () => {
    const res = await saveAvailabilityAction(windows);
    if (res.ok) toast.success("Saved. Your manager sees this when scheduling.");
    else toast.error(res.error);
  });

  // Shifts already published that the new windows would clash with. The schedule is not changed.
  const clashes = shifts.filter((sh) => windows.some((w) =>
    w.dayOfWeek === new Date(`${sh.day}T12:00:00Z`).getUTCDay() && w.startMinute < sh.endMin && sh.startMin < w.endMinute));

  return (
    <div className="grid max-w-2xl gap-4">
      {clashes.length > 0 && (
        <div role="status" className="rounded-md border-l-4 border-warning bg-warning-bg p-3 text-sm">
          <p className="font-semibold">You already have {clashes.length === 1 ? "a shift" : "shifts"} at these times:</p>
          <ul className="mt-1">{clashes.map((c) => <li key={c.id}>{dayName(c.day)}, {compactRange(c.startMin, c.endMin)} at {c.store}</li>)}</ul>
          <p className="mt-1">Availability does not remove shifts. For these days, <a href="/requests" className="underline underline-offset-2">ask for time off</a>.</p>
        </div>
      )}
      <ul className="divide-y rounded-md border">
        {DOW.map((dow, i) => {
          const mine = windows.filter((w) => w.dayOfWeek === dow);
          return (
            <li key={dow} className="grid gap-2 px-4 py-3 sm:grid-cols-[8rem_1fr]">
              <p className="font-medium">{DAYS[i]}</p>
              <div className="flex flex-wrap items-center gap-2">
                {mine.length === 0 && <span className="text-sm text-muted-foreground">Available</span>}
                {mine.map((w) => (
                  <span key={`${w.startMinute}-${w.endMinute}`} className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-3 py-1 text-sm">
                    Cannot work: {describe(w)}
                    <button type="button" aria-label={`Remove ${describe(w)} on ${DAYS[i]}`} onClick={() => setWindows((ws) => ws.filter((x) => x !== w))}>
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                {draft?.day === dow ? (
                  <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
                    e.preventDefault();
                    const s = toMin(draft.from);
                    const end = draft.to === "00:00" ? 1440 : toMin(draft.to);
                    if (end <= s) return void toast.error("The end must be after the start.");
                    add({ dayOfWeek: dow, startMinute: s, endMinute: end });
                    setDraft(null);
                  }}>
                    <Input type="time" aria-label="From" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="h-8 w-28" />
                    <span className="text-sm">to</span>
                    <Input type="time" aria-label="To" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="h-8 w-28" />
                    <Button size="sm" type="submit">Add</Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                  </form>
                ) : (
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => add({ dayOfWeek: dow, startMinute: 0, endMinute: 1440 })} disabled={mine.some((w) => w.endMinute - w.startMinute === 1440)}>Block all day</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft({ day: dow, from: "09:00", to: "13:00" })}><Plus /> Block some hours</Button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || pending}>{pending && <Loader2 className="animate-spin" />}Save availability</Button>
        {dirty && <span className="text-sm text-muted-foreground">You have changes that are not saved.</span>}
      </div>
    </div>
  );
}
