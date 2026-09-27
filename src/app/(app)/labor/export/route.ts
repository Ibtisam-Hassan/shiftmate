import { db } from "@/lib/db";
import { costShifts } from "@/domain/labor";
import { fromDbDate, localDateOf, weekInterval, weekStartOf } from "@/domain/time";
import { getActor } from "@/server/authz/actor";
import { reportStores } from "@/server/services/labor-report";

const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** One row per shift for the chosen week, with the cost split into regular and overtime. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.role === "EMPLOYEE") return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const org = await db.organization.findFirstOrThrow();
  const stores = (await reportStores(actor)).filter((s) => !url.searchParams.get("store") || s.id === url.searchParams.get("store"));
  const rows = [["Date", "Store", "Person", "Position", "Start", "End", "Break (min)", "Paid hours", "Rate", "Regular", "Overtime", "Total"]];
  for (const store of stores) {
    const tz = store.timezone;
    const week = weekStartOf(url.searchParams.get("week") ?? localDateOf(new Date(), tz), org.weekStartsOn);
    const { start, end } = weekInterval(week, tz);
    const here = await db.shift.findMany({ where: { locationId: store.id, startsAt: { gte: start, lt: end } }, include: { user: true, position: true }, orderBy: { startsAt: "asc" } });
    const ids = here.flatMap((s) => (s.userId ? [s.userId] : []));
    const all = await db.shift.findMany({ where: { userId: { in: ids }, startsAt: { gte: start, lt: end } }, include: { location: true } });
    const rates = await db.payRate.findMany({ where: { userId: { in: ids } } });
    const { shifts: costs } = costShifts(all, {
      ...org, tzOf: (id) => all.find((s) => s.locationId === id)?.location.timezone ?? tz,
      ratesOf: (u) => rates.filter((r) => r.userId === u).map((r) => ({ hourlyRateCents: r.hourlyRateCents, effectiveFrom: fromDbDate(r.effectiveFrom) })),
    });
    const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    for (const s of here) {
      const c = costs.find((x) => x.shiftId === s.id);
      const dollars = (n?: number) => (n == null ? "" : (n / 100).toFixed(2));
      rows.push([
        localDateOf(s.startsAt, tz), store.name, s.user?.name ?? "Open shift", s.position?.name ?? "", time(s.startsAt), time(s.endsAt),
        String(s.breakMinutes), c ? ((c.regularMinutes + c.overtimeMinutes) / 60).toFixed(2) : "", dollars(c?.rateCents ?? undefined),
        dollars(c?.regularCents), dollars(c?.overtimeCents), c ? dollars(c.regularCents + c.overtimeCents) : "",
      ]);
    }
  }
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="shiftmate-labor.csv"` },
  });
}
