import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { requireActor } from "@/server/authz/actor";
import { getOrg } from "@/server/services/settings";
import { PositionsEditor } from "./positions-editor";
import { RulesForm } from "./rules-form";
import { StoresEditor } from "./stores-editor";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  if (actor.role !== "ADMIN") redirect("/");
  const org = await getOrg();
  const locations = await db.location.findMany({
    where: { archivedAt: null },
    include: { positions: { orderBy: { name: "asc" } }, _count: { select: { shifts: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Settings" description={`Rules and stores for ${org.name}.`} />
      <div className="grid gap-10">
        <section aria-labelledby="rules-h" className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <div>
            <h2 id="rules-h" className="font-semibold">Overtime and rest</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hours past the weekly limit need approval before a schedule is published.</p>
          </div>
          <RulesForm
            defaults={{
              overtimeThresholdHours: org.overtimeThresholdMinutes / 60,
              overtimeMultiplier: org.overtimeMultiplierPercent / 100,
              weekStartsOn: org.weekStartsOn,
              minRestHours: org.minRestMinutes / 60,
            }}
          />
        </section>
        <section aria-labelledby="stores-h" className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <div>
            <h2 id="stores-h" className="font-semibold">Stores</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each store keeps its own time zone and weekly labor budget.</p>
          </div>
          <StoresEditor
            stores={locations.map((l) => ({
              id: l.id, name: l.name, timezone: l.timezone, address: l.address ?? "",
              weeklyBudgetCents: l.weeklyBudgetCents, hasShifts: l._count.shifts > 0,
            }))}
          />
        </section>
        <section aria-labelledby="pos-h" className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <div>
            <h2 id="pos-h" className="font-semibold">Positions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Roles a shift can be for. Colours match the schedule.</p>
          </div>
          <PositionsEditor
            stores={locations.map((l) => ({
              id: l.id, name: l.name,
              positions: l.positions.map((p) => ({ id: p.id, name: p.name, color: p.color, archived: !!p.archivedAt })),
            }))}
          />
        </section>
      </div>
    </>
  );
}
