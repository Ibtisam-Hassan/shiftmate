import { describe, expect, it } from "vitest";
import { type ConflictInput, detectConflicts, publishBlockers } from "./conflicts";
import { atLocal } from "./time";

const TZ = "America/Chicago";
const at = (date: string, h: number) => atLocal(date, h * 60, TZ);
const shift = (id: string, userId: string | null, date: string, from: number, to: number, locationId = "dt") =>
  ({ id, userId, locationId, startsAt: at(date, from), endsAt: at(date, to) });

function run(over: Partial<ConflictInput>) {
  return detectConflicts({
    shifts: [], unavailability: [], approvedTimeOff: [],
    membership: () => ["dt", "rv"], tzOf: () => TZ,
    locationName: (id) => ({ dt: "Downtown", rv: "Riverside", op: "Oak Park" })[id] ?? id,
    minRestMinutes: 480, ...over,
  });
}
const kinds = (cs: { kind: string; shiftId: string }[], id: string) => cs.filter((c) => c.shiftId === id).map((c) => c.kind).sort();

describe("detectConflicts", () => {
  it("flags overlapping shifts on both sides, across stores, as blocking", () => {
    const cs = run({ shifts: [shift("a", "u", "2026-09-30", 9, 17, "dt"), shift("b", "u", "2026-09-30", 13, 19, "rv")] });
    expect(kinds(cs, "a")).toEqual(["OVERLAP"]);
    expect(kinds(cs, "b")).toEqual(["OVERLAP"]);
    expect(cs.find((c) => c.shiftId === "a")!.detail).toContain("at Riverside");
    expect(cs.every((c) => c.severity === "block")).toBe(true);
  });

  it("allows back-to-back shifts and ignores open shifts", () => {
    const cs = run({
      shifts: [shift("a", "u", "2026-09-30", 9, 13), shift("b", "u", "2026-09-30", 13, 17), shift("c", null, "2026-09-30", 9, 17), shift("d", null, "2026-09-30", 9, 17)],
    });
    expect(cs).toEqual([]);
  });

  it("warns on short rest measured from the latest previous shift", () => {
    // Close Friday 14–22, open Saturday 06: 8h gap is fine; 05:00 is 7h.
    const ok = run({ shifts: [shift("a", "u", "2026-10-02", 14, 22), shift("b", "u", "2026-10-03", 6, 14)] });
    expect(ok).toEqual([]);
    const short = run({ shifts: [shift("x", "u", "2026-10-01", 8, 12), shift("a", "u", "2026-10-02", 14, 22), shift("b", "u", "2026-10-03", 5, 13)] });
    expect(kinds(short, "b")).toEqual(["SHORT_REST"]);
    expect(short.find((c) => c.shiftId === "b")!.relatedShiftId).toBe("a");
  });

  it("warns when scheduled during recurring unavailability, respecting effective dates", () => {
    const w = { userId: "u", dayOfWeek: 2, startMinute: 0, endMinute: 780, kind: "UNAVAILABLE" as const, effectiveFrom: "2026-09-01", effectiveTo: null };
    const tue = run({ shifts: [shift("a", "u", "2026-09-29", 9, 17)], unavailability: [w] });
    expect(kinds(tue, "a")).toEqual(["UNAVAILABLE"]);
    expect(tue[0].detail).toBe("Marked unavailable until 13:00.");
    const afternoon = run({ shifts: [shift("a", "u", "2026-09-29", 13, 21)], unavailability: [w] });
    expect(afternoon).toEqual([]);
    const expired = run({ shifts: [shift("a", "u", "2026-09-29", 9, 17)], unavailability: [{ ...w, effectiveTo: "2026-09-15" }] });
    expect(expired).toEqual([]);
  });

  it("catches unavailability on the second day of an overnight shift", () => {
    const sat = { userId: "u", dayOfWeek: 6, startMinute: 0, endMinute: 1440, kind: "UNAVAILABLE" as const, effectiveFrom: "2026-01-01", effectiveTo: null };
    const overnight = { id: "n", userId: "u", locationId: "dt", startsAt: at("2026-10-02", 20), endsAt: atLocal("2026-10-02", 26 * 60, TZ) };
    expect(kinds(run({ shifts: [overnight], unavailability: [sat] }), "n")).toEqual(["UNAVAILABLE"]);
  });

  it("warns on approved time off and on a store the person isn't assigned to", () => {
    const cs = run({
      shifts: [shift("a", "u", "2026-10-02", 9, 17, "op")],
      approvedTimeOff: [{ userId: "u", startsAt: at("2026-10-02", 0), endsAt: at("2026-10-04", 0) }],
    });
    expect(kinds(cs, "a")).toEqual(["NOT_ASSIGNED_TO_LOCATION", "TIME_OFF"]);
  });

  it("marks warnings as overridden but never blocks", () => {
    const cs = run({
      shifts: [shift("a", "u", "2026-10-02", 9, 17, "op"), shift("b", "u", "2026-10-02", 10, 12, "op")],
      overrides: [{ shiftId: "a", kind: "NOT_ASSIGNED_TO_LOCATION" }, { shiftId: "a", kind: "OVERLAP" }],
    });
    const a = cs.filter((c) => c.shiftId === "a");
    expect(a.find((c) => c.kind === "NOT_ASSIGNED_TO_LOCATION")!.overridden).toBe(true);
    expect(a.find((c) => c.kind === "OVERLAP")!.overridden).toBe(false);
    const { blocking, unresolvedWarnings } = publishBlockers(cs);
    expect(blocking).toHaveLength(2);
    expect(unresolvedWarnings.map((c) => c.shiftId)).toEqual(["b"]);
  });

  it("only reports conflicts for the shifts being checked, but uses neighbours for context", () => {
    const cs = run({
      shifts: [shift("prev", "u", "2026-09-27", 18, 23), shift("a", "u", "2026-09-28", 6, 14)],
      checkShiftIds: new Set(["a"]),
    });
    expect(cs.map((c) => [c.shiftId, c.kind])).toEqual([["a", "SHORT_REST"]]);
  });
});
