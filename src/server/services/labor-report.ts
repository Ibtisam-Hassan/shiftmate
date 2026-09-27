import "server-only";
import { db } from "@/lib/db";
import { summarize } from "@/domain/labor";
import { addDays, localDateOf, weekStartOf } from "@/domain/time";
import { type Actor, ForbiddenError, managedLocationIds } from "@/server/authz/policy";
import { laborFor } from "./board-parts";

export interface WeekCost {
  weekStart: string;
  scheduledMinutes: number;
  regularCents: number;
  overtimeCents: number;
  totalCents: number;
  draft: boolean;
}

export interface StoreReport {
  id: string;
  name: string;
  budgetCents: number | null;
  weeks: WeekCost[];
}

export interface PersonCost {
  userId: string;
  name: string;
  /** Every store the person worked at that week, with the cost at each. */
  stores: { name: string; costCents: number }[];
  minutes: number;
  overtimeMinutes: number;
  costCents: number;
}

/** Stores the actor may see costs for. Employees never see labor cost. */
export async function reportStores(actor: Actor) {
  if (actor.role === "EMPLOYEE") throw new ForbiddenError();
  const scope = managedLocationIds(actor);
  return db.location.findMany({ where: { archivedAt: null, ...(scope ? { id: { in: scope } } : {}) }, orderBy: { name: "asc" } });
}

/** Weekly cost per store for the last 8 weeks and next week, plus a per-person table for one week. */
export async function laborReport(actor: Actor, opts: { storeId?: string; week?: string; now?: Date } = {}) {
  const org = await db.organization.findFirstOrThrow();
  const all = await reportStores(actor);
  const stores = opts.storeId ? all.filter((s) => s.id === opts.storeId) : all;
  const tz = stores[0]?.timezone ?? "America/Chicago";
  const thisWeek = weekStartOf(localDateOf(opts.now ?? new Date(), tz), org.weekStartsOn);
  const weeks = Array.from({ length: 9 }, (_, i) => addDays(thisWeek, (i - 7) * 7));
  const selected = opts.week && weeks.includes(opts.week) ? opts.week : thisWeek;

  const reports: StoreReport[] = [];
  const people = new Map<string, PersonCost>();
  const drafts = await db.scheduleWeek.findMany({ where: { locationId: { in: stores.map((s) => s.id) }, status: "DRAFT" }, select: { locationId: true, weekStart: true } });
  const isDraft = (locationId: string, week: string) => drafts.some((d) => d.locationId === locationId && d.weekStart.toISOString().startsWith(week));
  for (const store of stores) {
    const rows: WeekCost[] = [];
    for (const week of weeks) {
      const { costs } = await laborFor(store.id, store.timezone, week, org);
      const here = costs.shifts.filter((c) => c.locationId === store.id);
      const s = summarize(here);
      rows.push({ weekStart: week, scheduledMinutes: s.scheduledMinutes, regularCents: s.regularCents, overtimeCents: s.overtimeCents, totalCents: s.totalCents, draft: isDraft(store.id, week) });
      if (week !== selected) continue;
      const names = new Map((await db.user.findMany({ where: { id: { in: here.map((c) => c.userId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
      for (const userId of new Set(here.map((c) => c.userId))) {
        const mine = here.filter((c) => c.userId === userId);
        const week = costs.weeks.find((w) => w.userId === userId);
        const cost = mine.reduce((a, c) => a + c.regularCents + c.overtimeCents, 0);
        const person = people.get(userId) ?? {
          userId, name: names.get(userId) ?? "Unknown", stores: [], costCents: 0,
          minutes: week?.scheduledMinutes ?? 0, overtimeMinutes: week?.overtimeMinutes ?? 0,
        };
        person.stores.push({ name: store.name, costCents: cost });
        person.costCents += cost;
        people.set(userId, person);
      }
    }
    reports.push({ id: store.id, name: store.name, budgetCents: store.weeklyBudgetCents, weeks: rows });
  }
  const list = [...people.values()].sort((a, b) => b.costCents - a.costCents);
  return { stores: reports, allStores: all.map((s) => ({ id: s.id, name: s.name })), weeks, thisWeek, selected, people: list, overtimeThreshold: org.overtimeThresholdMinutes };
}
