import { addDays, atLocal, dayOfWeek, weekDates } from "@/domain/time";
import { DAY_SLOTS, TZ, WEEKEND_EXTRA } from "./data";
import type { SeedContext } from "./people";
import { type Person, type PlannedShift, Roster } from "./roster";

const WEEKLY_CAP = 38 * 60;

/**
 * Two past weeks and this week are published everywhere. Next week is a draft only at Downtown,
 * where the manager demo's problems live. Riverside is planned first each week so the demo
 * employee (Downtown + Riverside) always has published Riverside shifts coming up.
 */
export async function planWeeks(ctx: SeedContext, people: Person[], thisWeek: string) {
  const roster = new Roster();
  const rows: PlannedShift[] = [];
  const order = [1, 0, 2];
  for (const week of [-14, -7, 0, 7].map((d) => addDays(thisWeek, d))) {
    for (const si of order) {
      const store = ctx.stores[si];
      const draft = week > thisWeek && si === 0;
      const sw = await ctx.db.scheduleWeek.create({
        data: {
          locationId: store.id, weekStart: new Date(week), status: draft ? "DRAFT" : "PUBLISHED",
          publishedAt: draft ? null : atLocal(addDays(week, -4), 600, TZ),
        },
      });
      const pool = people.filter((p) => p.stores.includes(si));
      for (const date of weekDates(week)) {
        const weekend = dayOfWeek(date) === 0 || dayOfWeek(date) === 6;
        for (const [startMin, endMin, pos, breakMinutes] of weekend ? [...DAY_SLOTS, ...WEEKEND_EXTRA] : DAY_SLOTS) {
          const s: PlannedShift = {
            scheduleWeekId: sw.id, locationId: store.id, userId: null, positionId: store.positions[pos],
            startsAt: atLocal(date, startMin, TZ), endsAt: atLocal(date, endMin, TZ), breakMinutes,
            week, date, startMin, endMin,
          };
          const len = endMin - startMin - breakMinutes;
          const who = pool
            .filter((p) => roster.isFree(p, s) && roster.minutes(p.id, week) + len <= WEEKLY_CAP)
            .sort((a, b) => roster.minutes(a.id, week) - roster.minutes(b.id, week) || ctx.rand() - 0.5)[0];
          roster.assign(s, who?.id ?? null);
          rows.push(s);
        }
      }
    }
  }
  return { rows, roster };
}
