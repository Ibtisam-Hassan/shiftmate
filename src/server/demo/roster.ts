import { dayOfWeek, overlaps } from "@/domain/time";

export interface PlannedShift {
  scheduleWeekId: string;
  locationId: string;
  userId: string | null;
  positionId: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
  /** Planning-only fields (stripped before saving): the local date and minutes of the slot. */
  week: string;
  date: string;
  startMin: number;
  endMin: number;
}

export interface Person {
  id: string;
  name: string;
  /** Store indexes; the first is the home store. */
  stores: number[];
  /** [dayOfWeek, startMinute, endMinute] windows the person can't work. */
  unavailable: [number, number, number][];
}

const paid = (s: PlannedShift) => (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000 - s.breakMinutes;

/** Tracks who is booked when, and their hours per week, while the demo is planned. */
export class Roster {
  private booked = new Map<string, PlannedShift[]>();

  minutes(userId: string, week: string) {
    return (this.booked.get(userId) ?? []).filter((s) => s.week === week).reduce((a, s) => a + paid(s), 0);
  }

  isFree(p: Person, s: PlannedShift) {
    const unavailable = p.unavailable.some(([d, from, to]) => d === dayOfWeek(s.date) && s.startMin < to && from < s.endMin);
    const busy = (this.booked.get(p.id) ?? []).some((b) => b !== s && overlaps(b.startsAt, b.endsAt, s.startsAt, s.endsAt));
    return !unavailable && !busy;
  }

  assign(s: PlannedShift, userId: string | null) {
    if (s.userId) this.booked.set(s.userId, (this.booked.get(s.userId) ?? []).filter((b) => b !== s));
    s.userId = userId;
    if (userId) this.booked.set(userId, [...(this.booked.get(userId) ?? []), s]);
  }
}
