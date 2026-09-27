import { describe, expect, it } from "vitest";
import { type CandidateInput, rankCandidates } from "./assign";

const RULES = { overtimeThresholdMinutes: 2400, overtimeMultiplierPercent: 150, minRestMinutes: 480 };
const d = (iso: string) => new Date(iso);
const SLOT = { startsAt: d("2026-10-03T15:00:00Z"), endsAt: d("2026-10-03T23:00:00Z"), paidMinutes: 450, localDate: "2026-10-03" };
const person = (over: Partial<CandidateInput> & { userId: string }): CandidateInput => ({
  name: over.userId, weekMinutes: 1800, rateCents: 2000, shifts: [], unavailableReason: null, onTimeOff: false, ...over,
});

describe("rankCandidates", () => {
  it("excludes busy, time-off and unavailable people with reasons", () => {
    const { ranked, excluded } = rankCandidates(SLOT, [
      person({ userId: "busy", shifts: [{ startsAt: d("2026-10-03T17:00:00Z"), endsAt: d("2026-10-03T22:00:00Z"), localDate: "2026-10-03", label: "12:00–5:00" }] }),
      person({ userId: "off", onTimeOff: true }),
      person({ userId: "unavail", unavailableReason: "Unavailable Saturdays" }),
      person({ userId: "ok" }),
    ], RULES);
    expect(ranked.map((c) => c.userId)).toEqual(["ok"]);
    expect(excluded.map((e) => [e.userId, e.reason])).toEqual([
      ["busy", "Working 12:00–5:00"], ["off", "Time off"], ["unavail", "Unavailable Saturdays"],
    ]);
  });

  it("ranks by added overtime, then rest, then same-day work, then cost", () => {
    const { ranked } = rankCandidates(SLOT, [
      person({ userId: "ot", weekMinutes: 2300 }), // +350 min OT
      person({ userId: "rest", shifts: [{ startsAt: d("2026-10-04T02:00:00Z"), endsAt: d("2026-10-04T05:00:00Z"), localDate: "2026-10-03", label: "" }] }),
      person({ userId: "pricey", rateCents: 2500 }),
      person({ userId: "cheap", rateCents: 1500 }),
    ], RULES);
    expect(ranked.map((c) => c.userId)).toEqual(["cheap", "pricey", "rest", "ot"]);
    const ot = ranked.find((c) => c.userId === "ot")!;
    expect(ot.addedOvertimeMinutes).toBe(350);
    expect(ot.addedCostCents).toBe(Math.round((100 * 2000 + 350 * 2000 * 1.5) / 60));
  });

  it("only counts overtime that this shift adds", () => {
    const { ranked } = rankCandidates(SLOT, [person({ userId: "already", weekMinutes: 2500 })], RULES);
    expect(ranked[0].addedOvertimeMinutes).toBe(450);
  });
});
