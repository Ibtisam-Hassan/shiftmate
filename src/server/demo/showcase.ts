import { addDays, atLocal, dayOfWeek } from "@/domain/time";
import { TZ } from "./data";
import type { SeedContext } from "./people";
import type { Person, PlannedShift, Roster } from "./roster";

/**
 * Plants the problems the manager demo should show in next week's Downtown draft:
 * one person over 40 hours, one availability clash, and one open shift.
 */
export function plantProblems(rows: PlannedShift[], roster: Roster, people: Person[], demo: Person, downtownId: string, nextWeek: string) {
  const draft = rows.filter((s) => s.locationId === downtownId && s.week === nextWeek);
  const ot = people.find((p) => p.stores[0] === 0 && p.id !== demo.id && p.unavailable.length === 0);
  if (ot) {
    for (const s of draft) {
      if (roster.minutes(ot.id, nextWeek) > 40 * 60) break;
      if (s.userId !== ot.id && roster.isFree(ot, s)) roster.assign(s, ot.id);
    }
  }
  const student = people.find((p) => p.stores[0] === 0 && p.unavailable.some(([d]) => d === 2));
  const tuesday = draft.find((s) => dayOfWeek(s.date) === 2 && s.startMin < 780 && s.userId && s.userId !== ot?.id && s.userId !== student?.id);
  // Ignore their unavailability here on purpose: this clash is the warning the demo shows.
  if (student && tuesday && roster.isFree({ ...student, unavailable: [] }, tuesday)) {
    roster.assign(tuesday, student.id);
  }
  const friday = draft.find((s) => dayOfWeek(s.date) === 5 && s.userId && s.userId !== ot?.id);
  if (friday) roster.assign(friday, null);
}

/**
 * Real stores run some overtime. Push one person past 40 hours in two past weeks, and record the
 * approvals a manager would have given before publishing.
 */
export function plantPastOvertime(rows: PlannedShift[], roster: Roster, people: Person[], weeks: string[], storeIds: string[]) {
  const approved: { userId: string; week: string }[] = [];
  weeks.forEach((week, i) => {
    const storeIdx = i % storeIds.length;
    const person = people.find((p) => p.stores.length === 1 && p.stores[0] === storeIdx && p.unavailable.length === 0);
    if (!person) return;
    for (const s of rows.filter((r) => r.week === week && r.locationId === storeIds[storeIdx])) {
      if (roster.minutes(person.id, week) > 42 * 60) break;
      if (s.userId !== person.id && roster.isFree(person, s)) roster.assign(s, person.id);
    }
    approved.push({ userId: person.id, week });
  });
  return approved;
}

/** A pending swap from the demo employee, one pending and one approved time-off request. */
export async function plantRequests(ctx: SeedContext, people: Person[], demo: Person, thisWeek: string, now: Date) {
  const shift = await ctx.db.shift.findFirst({
    where: { userId: demo.id, startsAt: { gt: now }, scheduleWeek: { status: "PUBLISHED" } },
    orderBy: { startsAt: "asc" },
  });
  const storeIdx = ctx.stores.findIndex((st) => st.id === shift?.locationId);
  const coworker = people.find((p) => p.id !== demo.id && p.stores.includes(storeIdx));
  if (shift && coworker) {
    await ctx.db.swapRequest.create({
      data: { shiftId: shift.id, requesterId: demo.id, targetUserId: coworker.id, message: "Family thing that evening. Could you cover?" },
    });
  }
  const nextWeek = addDays(thisWeek, 7);
  const someone = people.find((p) => p.stores[0] === 0 && p.id !== demo.id);
  if (someone) {
    await ctx.db.timeOffRequest.create({
      data: { userId: someone.id, reason: "Cousin's wedding", startsAt: atLocal(addDays(nextWeek, 4), 0, TZ), endsAt: atLocal(addDays(nextWeek, 6), 0, TZ) },
    });
  }
  await ctx.db.timeOffRequest.create({
    data: { userId: demo.id, reason: "Dentist", status: "APPROVED", startsAt: atLocal(addDays(thisWeek, 14), 0, TZ), endsAt: atLocal(addDays(thisWeek, 15), 0, TZ) },
  });
}
