import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { dayLabel, hours, range } from "@/app/(app)/schedule/format";
import { requireActor } from "@/server/authz/actor";
import { myUpcomingShifts } from "@/server/services/my-shifts";
import { listSwaps } from "@/server/services/swap-list";
import { NextShift } from "./next-shift";
import { SwapButton } from "./swap-dialog";
import { SwapInbox } from "./swap-inbox";

export const metadata = { title: "My shifts" };

export default async function MyShiftsPage() {
  const actor = await requireActor();
  if (actor.role !== "EMPLOYEE") redirect("/schedule");
  const now = new Date();
  const [shifts, swaps] = await Promise.all([myUpcomingShifts(actor, now), listSwaps(actor)]);
  const [next, ...rest] = shifts;
  const total = shifts.reduce((a, s) => a + s.paidMinutes, 0);

  return (
    <>
      <PageHeader title="My shifts" description={shifts.length ? `${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"} in the next two weeks, ${hours(total)} paid.` : undefined} />
      <div className="grid max-w-3xl gap-6">
        {next ? <NextShift shift={next} now={now.getTime()} /> : (
          <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">You have no published shifts in the next two weeks.</p>
        )}
        <SwapInbox rows={swaps} me={actor.id} />
        {shifts.length > 0 && (
          <section aria-label="Upcoming shifts" className="grid gap-2">
            <h2 className="font-semibold">Coming up</h2>
            <ul className="divide-y rounded-md border">
              {(next ? [next, ...rest] : rest).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="w-28 font-semibold">{dayLabel(s.day).long.split(",")[0]} {dayLabel(s.day).num}</span>
                  <span className="font-numeric text-xl leading-none">{range(s.startMin, s.endMin)}</span>
                  <span className="text-sm text-muted-foreground">{s.position?.name ?? "Shift"}, {s.store}</span>
                  <span className="ml-auto">
                    {new Date(s.startsAt) <= now ? <span className="text-sm text-muted-foreground">On now</span>
                      : s.swapPending ? <span className="text-sm text-muted-foreground">Swap offered</span>
                      : <SwapButton shiftId={s.id} label={`${dayLabel(s.day).long}, ${range(s.startMin, s.endMin)} at ${s.store}`} />}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
