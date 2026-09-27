import { describe, expect, it } from "vitest";
import { costShifts, paidMinutes, summarize } from "./labor";
import { atLocal } from "./time";

const TZ = "America/Chicago";
const RULES = { overtimeThresholdMinutes: 2400, overtimeMultiplierPercent: 150, weekStartsOn: 1 };
let n = 0;
const shift = (userId: string | null, date: string, from: number, to: number, locationId = "dt", breakMinutes = 30) =>
  ({ id: `s${n++}`, userId, locationId, startsAt: atLocal(date, from * 60, TZ), endsAt: atLocal(date, to * 60, TZ), breakMinutes });
const opts = (rates: Record<string, { hourlyRateCents: number; effectiveFrom: string }[]>) =>
  ({ ...RULES, tzOf: () => TZ, ratesOf: (u: string) => rates[u] ?? [] });
const MON = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

describe("labor", () => {
  it("pays unpaid breaks as zero", () => {
    expect(paidMinutes(shift("u", MON[0], 9, 17))).toBe(450);
  });

  it("puts overtime on the last shifts of the week, at 1.5x", () => {
    // 6 × 7.5h = 45h → 5h overtime, all of it in Saturday's shift.
    const shifts = MON.slice(0, 6).map((d) => shift("u", d, 9, 17));
    const { shifts: costs, weeks } = costShifts(shifts, opts({ u: [{ hourlyRateCents: 2000, effectiveFrom: "2026-01-01" }] }));
    expect(weeks).toEqual([{ userId: "u", weekStart: "2026-09-28", scheduledMinutes: 2700, overtimeMinutes: 300 }]);
    const sat = costs.at(-1)!;
    expect([sat.regularMinutes, sat.overtimeMinutes]).toEqual([150, 300]);
    const sum = summarize(costs);
    expect(sum.regularCents).toBe(80000); // 40h × $20
    expect(sum.overtimeCents).toBe(15000); // 5h × $30
    expect(sum.totalCents).toBe(95000);
  });

  it("counts hours across stores toward one workweek; the later store carries the overtime", () => {
    const shifts = [
      ...MON.slice(0, 5).map((d) => shift("u", d, 8, 16, "dt")), // 37.5h
      shift("u", MON[5], 10, 16, "rv"), // 5.5h → 3h OT at Riverside
    ];
    const { shifts: costs } = costShifts(shifts, opts({ u: [{ hourlyRateCents: 1800, effectiveFrom: "2026-01-01" }] }));
    const rv = costs.filter((c) => c.locationId === "rv");
    expect(rv[0].overtimeMinutes).toBe(180);
    expect(costs.filter((c) => c.locationId === "dt").every((c) => c.overtimeMinutes === 0)).toBe(true);
  });

  it("resets each workweek, cut at the store's local Monday midnight", () => {
    const shifts = [
      ...MON.map((d) => shift("u", d, 9, 17)), // 52.5h in one week
      shift("u", "2026-10-05", 0, 4, "dt", 0), // Monday 00:00 local: next week
    ];
    const { weeks } = costShifts(shifts, opts({}));
    expect(weeks.map((w) => [w.weekStart, w.overtimeMinutes])).toEqual([["2026-09-28", 750], ["2026-10-05", 0]]);
  });

  it("uses the rate in force on each shift's date and reports unpriced shifts", () => {
    const shifts = [shift("u", MON[0], 9, 17), shift("u", MON[3], 9, 17), shift("v", MON[0], 9, 17)];
    const { shifts: costs } = costShifts(shifts, opts({
      u: [{ hourlyRateCents: 1600, effectiveFrom: "2026-01-01" }, { hourlyRateCents: 2000, effectiveFrom: "2026-10-01" }],
    }));
    expect(costs.map((c) => c.rateCents)).toEqual([1600, 2000, null]);
    const sum = summarize(costs, [shift(null, MON[1], 9, 17)]);
    expect(sum.unpricedShifts).toBe(1);
    expect(sum.openShifts).toBe(1);
    expect(sum.openMinutes).toBe(450);
    expect(sum.totalCents).toBe(12000 + 15000);
  });
});
