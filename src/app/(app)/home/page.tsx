import Link from "next/link";
import { redirect } from "next/navigation";
import { dayName } from "@/domain/format";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/authz/actor";
import { getDashboard } from "@/server/services/dashboard";
import { NextWeek } from "./next-week";
import { LaborBudget, OvertimeRisk, Recent } from "./side";
import { Summary } from "./summary";
import { TodayFloor } from "./today-floor";
import { Waiting } from "./waiting";

export const metadata = { title: "Home" };

function Section({ id, title, children, aside }: { id?: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="grid scroll-mt-20 gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${id ?? title}-h`} className="font-semibold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const actor = await requireActor();
  if (actor.role === "EMPLOYEE") redirect("/my-shifts");
  const { store } = await searchParams;
  const d = await getDashboard(actor, typeof store === "string" ? store : undefined);
  const open = d.todayShifts.filter((s) => !s.userId).length;

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <h1 className="font-numeric text-5xl leading-none">{dayName(d.today, true)}</h1>
          {d.stores.length > 1 && (
            <nav aria-label="Store" className="flex rounded-md bg-muted p-0.5">
              {d.stores.map((s) => (
                <Link key={s.id} href={`/home?store=${s.id}`} aria-current={s.id === d.store.id ? "page" : undefined}
                  className={cn("rounded px-3 py-1 text-sm font-medium text-muted-foreground", s.id === d.store.id && "bg-card text-foreground shadow-sm")}>
                  {s.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <Summary d={d} />
      </header>
      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-8">
          <Section id="today" title={`Today at ${d.store.name}`} aside={`${d.todayShifts.length - open} people, ${open} open`}>
            <TodayFloor d={d} />
          </Section>
          <Section title={`Next week, from ${dayName(d.nextWeek.weekStart)}`} aside={d.nextWeek.status === "PUBLISHED" ? "Published" : "Draft"}>
            <NextWeek d={d} />
          </Section>
        </div>
        <div className="grid content-start gap-8">
          <Section id="waiting" title="Waiting on you"><Waiting d={d} /></Section>
          <Section title="Labor against budget"><LaborBudget d={d} /></Section>
          <Section title="Close to overtime next week" aside={`${d.nextWeek.rules.overtimeThresholdMinutes / 60} h limit`}><OvertimeRisk d={d} /></Section>
          <Section title="Recent changes"><Recent d={d} /></Section>
        </div>
      </div>
    </div>
  );
}
