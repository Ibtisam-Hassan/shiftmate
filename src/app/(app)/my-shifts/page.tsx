import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { dayName } from "@/domain/format";
import { dayLabel, hours, range } from "@/app/(app)/schedule/format";
import { HoursMeter } from "@/app/(app)/schedule/hours-meter";
import { requireActor } from "@/server/authz/actor";
import { type MyShift, myUpcomingShifts, myWeek } from "@/server/services/my-shifts";
import { listSwaps } from "@/server/services/swap-list";
import { type TimeOffRow, listTimeOff } from "@/server/services/time-off-list";
import { NextShift } from "./next-shift";
import { SwapButton } from "./swap-dialog";
import { SwapInbox } from "./swap-inbox";

export const metadata = { title: "My shifts" };

export default async function MyShiftsPage() {
  const actor = await requireActor();
  if (actor.role !== "EMPLOYEE") redirect("/home");
  const now = new Date();
  const [shifts, swaps, timeOff, week] = await Promise.all([myUpcomingShifts(actor, now), listSwaps(actor), listTimeOff(actor), myWeek(actor, now)]);
  const [next] = shifts;
  const total = shifts.reduce((a, s) => a + s.paidMinutes, 0);
  const soon = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const off = timeOff.filter((t) => t.status === "APPROVED" && t.from <= soon && t.to >= now.toISOString().slice(0, 10));
  // One list, by date: shifts plus approved days off.
  const items: { key: string; date: string; shift?: MyShift; off?: TimeOffRow }[] = [
    ...shifts.map((s) => ({ key: s.id, date: s.day, shift: s })),
    ...off.map((t) => ({ key: t.id, date: t.from, off: t })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader title="My shifts" description={shifts.length ? `${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"} in the next two weeks, ${hours(total)} paid.` : undefined} />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-6">
          {next ? <NextShift shift={next} now={now.getTime()} /> : (
            <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">You have no published shifts in the next two weeks.</p>
          )}
          <div className="xl:hidden"><SwapInbox rows={swaps} me={actor.id} /></div>
          {items.length > 0 && (
            <section aria-label="Upcoming shifts" className="grid gap-2">
              <h2 className="font-semibold">Coming up</h2>
              <ul className="divide-y rounded-md border">
                {items.map((it) => it.shift ? (
                  <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="w-28 font-semibold">{dayLabel(it.shift.day).long.split(",")[0]} {dayLabel(it.shift.day).num}</span>
                    <span className="font-numeric text-xl leading-none">{range(it.shift.startMin, it.shift.endMin)}</span>
                    <span className="text-sm text-muted-foreground">{it.shift.position?.name ?? "Shift"}, {it.shift.store}</span>
                    <span className="ml-auto">
                      {new Date(it.shift.startsAt) <= now ? <span className="text-sm text-muted-foreground">On now</span>
                        : it.shift.swapPending ? <span className="text-sm text-muted-foreground">Swap offered</span>
                        : <SwapButton shiftId={it.shift.id} label={`${dayLabel(it.shift.day).long}, ${range(it.shift.startMin, it.shift.endMin)} at ${it.shift.store}`} />}
                    </span>
                  </li>
                ) : (
                  <li key={it.key} className="flex items-center gap-4 bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,var(--card)_6px_12px)] px-4 py-3">
                    <span className="font-semibold">{it.off!.from === it.off!.to ? dayName(it.off!.from) : `${dayName(it.off!.from)} to ${dayName(it.off!.to)}`}</span>
                    <span className="text-sm">Time off{it.off!.reason ? `: ${it.off!.reason}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="hidden content-start gap-6 xl:grid" aria-label="This week">
          <section className="grid gap-2">
            <h2 className="font-semibold">This week</h2>
            <HoursMeter minutes={week.minutes} threshold={week.limit} />
            <p className="text-xs text-muted-foreground">Hours at every store. The limit is {hours(week.limit)}.</p>
          </section>
          <SwapInbox rows={swaps} me={actor.id} />
          <section className="grid gap-2">
            <h2 className="font-semibold">Time off</h2>
            {off.length ? <p className="text-sm">{off.length} approved in the next two weeks.</p> : <p className="text-sm text-muted-foreground">None coming up.</p>}
            <Button asChild variant="outline" className="w-fit"><Link href="/requests">Ask for time off</Link></Button>
          </section>
        </aside>
      </div>
    </>
  );
}
