import { overlaps } from "./time";

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  paidMinutes: number;
  localDate: string;
}

export interface CandidateInput {
  userId: string;
  name: string;
  /** Minutes already scheduled this workweek, all stores. */
  weekMinutes: number;
  rateCents: number | null;
  /** Their other shifts around this week, any store (excluding the slot itself). */
  shifts: { startsAt: Date; endsAt: Date; localDate: string; label: string }[];
  unavailableReason: string | null;
  onTimeOff: boolean;
}

export interface Candidate {
  userId: string;
  name: string;
  beforeMinutes: number;
  afterMinutes: number;
  addedOvertimeMinutes: number;
  shortRest: boolean;
  worksThatDay: boolean;
  addedCostCents: number | null;
}

export interface Excluded {
  userId: string;
  name: string;
  reason: string;
}

/**
 * Who could take this shift, best first. Order: least added overtime, then no short-rest
 * risk, then not already working that day, then cheapest. Busy, unavailable and time-off
 * people are excluded with a reason so the manager sees why.
 */
export function rankCandidates(
  slot: Slot,
  people: CandidateInput[],
  rules: { overtimeThresholdMinutes: number; overtimeMultiplierPercent: number; minRestMinutes: number },
): { ranked: Candidate[]; excluded: Excluded[] } {
  const ranked: Candidate[] = [];
  const excluded: Excluded[] = [];
  const thr = rules.overtimeThresholdMinutes;
  for (const p of people) {
    const clash = p.shifts.find((s) => overlaps(s.startsAt, s.endsAt, slot.startsAt, slot.endsAt));
    if (clash) { excluded.push({ userId: p.userId, name: p.name, reason: `Working ${clash.label}` }); continue; }
    if (p.onTimeOff) { excluded.push({ userId: p.userId, name: p.name, reason: "Time off" }); continue; }
    if (p.unavailableReason) { excluded.push({ userId: p.userId, name: p.name, reason: p.unavailableReason }); continue; }

    const after = p.weekMinutes + slot.paidMinutes;
    const addedOt = Math.max(0, after - thr) - Math.max(0, p.weekMinutes - thr);
    const restMs = rules.minRestMinutes * 60_000;
    const shortRest = p.shifts.some((s) => {
      const gapBefore = slot.startsAt.getTime() - s.endsAt.getTime();
      const gapAfter = s.startsAt.getTime() - slot.endsAt.getTime();
      return (gapBefore > 0 && gapBefore < restMs) || (gapAfter > 0 && gapAfter < restMs);
    });
    const regular = slot.paidMinutes - addedOt;
    const cost = p.rateCents == null ? null
      : Math.round((regular * p.rateCents + addedOt * p.rateCents * (rules.overtimeMultiplierPercent / 100)) / 60);
    ranked.push({
      userId: p.userId, name: p.name, beforeMinutes: p.weekMinutes, afterMinutes: after,
      addedOvertimeMinutes: addedOt, shortRest, worksThatDay: p.shifts.some((s) => s.localDate === slot.localDate),
      addedCostCents: cost,
    });
  }
  ranked.sort((a, b) =>
    a.addedOvertimeMinutes - b.addedOvertimeMinutes ||
    Number(a.shortRest) - Number(b.shortRest) ||
    Number(a.worksThatDay) - Number(b.worksThatDay) ||
    (a.addedCostCents ?? Infinity) - (b.addedCostCents ?? Infinity) ||
    a.name.localeCompare(b.name));
  return { ranked, excluded };
}
