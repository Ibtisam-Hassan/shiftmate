import { describe, expect, it } from "vitest";
import { dayCoverage, gapRanges } from "./coverage";

const OPTS = { openMinute: 480, closeMinute: 1320, minCoverage: 2 };

describe("coverage", () => {
  it("counts people at each hour's midpoint", () => {
    const hours = dayCoverage([{ startMin: 540, endMin: 1020 }, { startMin: 480, endMin: 960 }], OPTS);
    const at = (h: number) => hours.find((x) => x.hour === h)!.count;
    expect([at(8), at(9), at(15), at(16), at(17)]).toEqual([1, 2, 2, 1, 0]);
  });

  it("flags open hours below the minimum and groups them into ranges", () => {
    const hours = dayCoverage([{ startMin: 480, endMin: 1200 }, { startMin: 480, endMin: 1260 }], OPTS);
    expect(gapRanges(hours)).toEqual([[20, 22]]);
    expect(hours.find((h) => h.hour === 6)!.gap).toBe(false); // closed hours never gap
  });

  it("counts an overnight shift on its start day", () => {
    const hours = dayCoverage([{ startMin: 1200, endMin: 1560 }, { startMin: 1200, endMin: 1560 }], OPTS);
    expect(hours.find((h) => h.hour === 22)!.count).toBe(2);
  });
});
