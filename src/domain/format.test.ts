import { describe, expect, it } from "vitest";
import { clockRange, clockTime, compactRange, dayName, whenAt } from "./format";

describe("format", () => {
  it("writes 12-hour times in lower case", () => {
    expect([clockTime(0), clockTime(780), clockTime(570), clockTime(1440)]).toEqual(["12:00 am", "1:00 pm", "9:30 am", "12:00 am"]);
    expect(clockRange(540, 1020)).toBe("9:00 am to 5:00 pm");
  });
  it("keeps grid times compact", () => {
    expect([compactRange(480, 960), compactRange(570, 1080), compactRange(1200, 1560)]).toEqual(["8–4", "9:30–6", "8–2"]);
  });
  it("names days and store-local instants", () => {
    expect(dayName("2026-09-28")).toBe("Mon, Sep 28");
    expect(whenAt(new Date("2026-09-28T16:00:00Z"), "America/Chicago")).toBe("Mon, Sep 28, 11:00 am");
  });
});
