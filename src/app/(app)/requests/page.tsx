import { PageHeader } from "@/components/page-header";
import { localDateOf } from "@/domain/time";
import { requireActor } from "@/server/authz/actor";
import { homeTimezone } from "@/server/services/home";
import { listSwaps } from "@/server/services/swap-list";
import { listTimeOff } from "@/server/services/time-off-list";
import { SwapReview } from "./swap-review";
import { TimeOffForm } from "./time-off-form";
import { TimeOffList } from "./time-off-list";

export const metadata = { title: "Requests" };

export default async function RequestsPage() {
  const actor = await requireActor();
  const rows = await listTimeOff(actor);
  if (actor.role === "EMPLOYEE") {
    const today = localDateOf(new Date(), await homeTimezone(actor.id));
    return (
      <>
        <PageHeader title="Requests" description="Ask for time off and follow your requests." />
        <div className="grid gap-6">
          <TimeOffForm today={today} />
          <section className="grid gap-2"><h2 className="font-semibold">Your time off</h2><TimeOffList rows={rows} mode="mine" /></section>
        </div>
      </>
    );
  }
  const pending = rows.filter((r) => r.status === "PENDING");
  const swaps = await listSwaps(actor);
  const swapsWaiting = swaps.filter((s) => s.status === "PENDING_MANAGER").length;
  return (
    <>
      <PageHeader title="Requests" description="Time off and shift swaps from your staff." />
      <div className="grid gap-8">
        <section className="grid gap-2"><h2 className="font-semibold">Time off waiting for you ({pending.length})</h2><TimeOffList rows={pending} mode="review" /></section>
        {swaps.length ? <section className="grid gap-2"><h2 className="font-semibold">Shift swaps{swapsWaiting ? ` (${swapsWaiting} waiting for you)` : ""}</h2><SwapReview rows={swaps} /></section>
          : <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Shift swaps:</span> none in the last 30 days.</p>}
        <section className="grid gap-2"><h2 className="font-semibold">Recent time off</h2><TimeOffList rows={rows.filter((r) => r.status !== "PENDING")} mode="review" /></section>
      </div>
    </>
  );
}
