import { addDays, dayOfWeek, localDateOf, minutesBetween, overlaps, atLocal } from "./time";

export type ConflictKind = "OVERLAP" | "UNAVAILABLE" | "TIME_OFF" | "SHORT_REST" | "NOT_ASSIGNED_TO_LOCATION";
export type Severity = "block" | "warn";

export const SEVERITY: Record<ConflictKind, Severity> = {
  OVERLAP: "block",
  UNAVAILABLE: "warn",
  TIME_OFF: "warn",
  SHORT_REST: "warn",
  NOT_ASSIGNED_TO_LOCATION: "warn",
};

export interface ScheduledShift {
  id: string;
  userId: string | null;
  locationId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface AvailabilityWindow {
  userId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  kind: "AVAILABLE" | "UNAVAILABLE";
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface Interval {
  userId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface Conflict {
  shiftId: string;
  kind: ConflictKind;
  severity: Severity;
  /** The other shift involved (overlap, short rest). */
  relatedShiftId?: string;
  /** A manager kept it anyway, with a recorded reason. Blocking conflicts can't be overridden. */
  overridden: boolean;
  detail: string;
}

export interface ConflictInput {
  /** Every shift that matters: the week being checked plus each person's neighbouring shifts, any store. */
  shifts: ScheduledShift[];
  /** Only these shifts get conflicts reported (defaults to all). */
  checkShiftIds?: Set<string>;
  unavailability: AvailabilityWindow[];
  approvedTimeOff: Interval[];
  membership: (userId: string) => string[];
  tzOf: (locationId: string) => string;
  locationName: (locationId: string) => string;
  minRestMinutes: number;
  overrides?: { shiftId: string; kind: string }[];
}

function fmt(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).replace(":00", "");
}

/** Local days a shift touches (an overnight shift touches two). */
function localDays(s: ScheduledShift, tz: string): string[] {
  const first = localDateOf(s.startsAt, tz);
  const last = localDateOf(new Date(s.endsAt.getTime() - 1), tz);
  const days = [first];
  for (let d = first; d < last; ) days.push((d = addDays(d, 1)));
  return days;
}

export function detectConflicts(input: ConflictInput): Conflict[] {
  const out: Conflict[] = [];
  const overridden = new Set((input.overrides ?? []).map((o) => `${o.shiftId}|${o.kind}`));
  const push = (c: Omit<Conflict, "severity" | "overridden">) =>
    out.push({ ...c, severity: SEVERITY[c.kind], overridden: SEVERITY[c.kind] === "warn" && overridden.has(`${c.shiftId}|${c.kind}`) });

  const byUser = new Map<string, ScheduledShift[]>();
  for (const s of input.shifts) if (s.userId) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  const checked = (id: string) => !input.checkShiftIds || input.checkShiftIds.has(id);

  for (const [userId, list] of byUser) {
    list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const stores = input.membership(userId);

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!checked(s.id)) continue;
      const tz = input.tzOf(s.locationId);

      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const o = list[j];
        if (overlaps(s.startsAt, s.endsAt, o.startsAt, o.endsAt)) {
          const where = o.locationId === s.locationId ? "" : ` at ${input.locationName(o.locationId)}`;
          push({ shiftId: s.id, kind: "OVERLAP", relatedShiftId: o.id,
            detail: `Also booked ${fmt(o.startsAt, tz)}–${fmt(o.endsAt, tz)}${where}.` });
        }
      }

      // Rest is measured from the shift that ended most recently before this one began.
      // Back-to-back (gap 0) is one continuous stint, not a rest problem.
      const previous = list
        .filter((o) => o.id !== s.id && o.endsAt <= s.startsAt)
        .reduce<ScheduledShift | null>((best, o) => (!best || o.endsAt > best.endsAt ? o : best), null);
      if (previous) {
        const gap = minutesBetween(previous.endsAt, s.startsAt);
        if (gap > 0 && gap < input.minRestMinutes) {
          push({ shiftId: s.id, kind: "SHORT_REST", relatedShiftId: previous.id,
            detail: `Only ${Math.round((gap / 60) * 10) / 10} h after their previous shift ends.` });
        }
      }

      if (!stores.includes(s.locationId)) {
        push({ shiftId: s.id, kind: "NOT_ASSIGNED_TO_LOCATION", detail: `Doesn't usually work at ${input.locationName(s.locationId)}.` });
      }

      const days = localDays(s, tz);
      const clash = input.unavailability.find((w) => {
        if (w.userId !== userId || w.kind !== "UNAVAILABLE") return false;
        return days.some((d) => {
          if (dayOfWeek(d) !== w.dayOfWeek || d < w.effectiveFrom || (w.effectiveTo && d > w.effectiveTo)) return false;
          return overlaps(s.startsAt, s.endsAt, atLocal(d, w.startMinute, tz), atLocal(d, w.endMinute, tz));
        });
      });
      if (clash) {
        const whole = clash.startMinute === 0 && clash.endMinute === 1440;
        const until = `${String(Math.floor(clash.endMinute / 60) % 24).padStart(2, "0")}:${String(clash.endMinute % 60).padStart(2, "0")}`;
        push({ shiftId: s.id, kind: "UNAVAILABLE", detail: whole ? "Marked unavailable all day." : `Marked unavailable until ${until}.` });
      }

      const off = input.approvedTimeOff.find((t) => t.userId === userId && overlaps(s.startsAt, s.endsAt, t.startsAt, t.endsAt));
      if (off) push({ shiftId: s.id, kind: "TIME_OFF", detail: "Has approved time off." });
    }
  }
  return out;
}

/** Conflicts that stop a week from being published: any block, or a warning nobody has kept on purpose. */
export function publishBlockers(conflicts: Conflict[]) {
  return {
    blocking: conflicts.filter((c) => c.severity === "block"),
    unresolvedWarnings: conflicts.filter((c) => c.severity === "warn" && !c.overridden),
  };
}
