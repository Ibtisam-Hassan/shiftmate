import { POSITION_BG, dayLabel, range, trackPosition } from "@/app/(app)/schedule/format";
import { cn } from "@/lib/utils";
import type { MyShift } from "@/server/services/my-shifts";

function countdown(startsAt: string, now: number) {
  const mins = Math.round((new Date(startsAt).getTime() - now) / 60_000);
  if (mins <= 0) return "on now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `in ${h} h ${mins % 60} min` : `in ${Math.round(h / 24)} days`;
}

/** The kraft hero: your next shift, big enough to read from across the break room. */
export function NextShift({ shift, now }: { shift: MyShift; now: number }) {
  const { left, width } = trackPosition(shift.startMin, shift.endMin);
  return (
    <section aria-label="Your next shift" className="rounded-md bg-kraft p-5 text-kraft-foreground">
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        Next shift: {dayLabel(shift.day).long}
        <span className="rounded-full bg-kraft-foreground px-2.5 py-0.5 text-xs text-kraft">{countdown(shift.startsAt, now)}</span>
      </p>
      <p className="mt-2 font-numeric text-6xl leading-none">{range(shift.startMin, shift.endMin)}</p>
      <p className="mt-2 text-sm">
        <span className="font-semibold">{shift.position?.name ?? "Shift"}</span> at <span className="font-semibold">{shift.store}</span>.
        {shift.breakMinutes > 0 && ` ${shift.breakMinutes} min unpaid break.`}
        {shift.with.length > 0 && ` With ${shift.with.join(", ")}.`}
      </p>
      <div className="relative mt-4 h-2 rounded-full bg-kraft-foreground/15" aria-hidden>
        <div className={cn("absolute inset-y-0 rounded-full", POSITION_BG[shift.position?.color ?? ""] ?? "bg-kraft-foreground")} style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] opacity-70" aria-hidden><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>
      {shift.notes && <p className="mt-3 text-sm">Note: {shift.notes}</p>}
    </section>
  );
}
