import { describe, expect, it } from "vitest";
import {
  addDays, atLocal, dayOfWeek, localDateOf, localMinuteOf, minutesBetween, weekInterval, weekStartOf,
} from "./time";

const CHI = "America/Chicago";

describe("calendar math", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the week start for Monday and Sunday weeks", () => {
    expect(dayOfWeek("2026-09-27")).toBe(0); // Sunday
    expect(weekStartOf("2026-09-27", 1)).toBe("2026-09-21");
    expect(weekStartOf("2026-09-27", 0)).toBe("2026-09-27");
    expect(weekStartOf("2026-09-21", 1)).toBe("2026-09-21");
  });
});

describe("zoned instants", () => {
  it("maps local wall time to the right instant", () => {
    // Chicago is UTC-5 in September (CDT).
    expect(atLocal("2026-09-21", 9 * 60, CHI).toISOString()).toBe("2026-09-21T14:00:00.000Z");
  });

  it("supports overnight end times via minute >= 1440", () => {
    const end = atLocal("2026-09-21", 26 * 60, CHI);
    expect(localDateOf(end, CHI)).toBe("2026-09-22");
    expect(localMinuteOf(end, CHI)).toBe(120);
  });

  it("keeps an 8h wall-clock shift 8h long on a normal day", () => {
    expect(minutesBetween(atLocal("2026-09-21", 540, CHI), atLocal("2026-09-21", 1020, CHI))).toBe(480);
  });

  it("counts real elapsed time across the spring-forward gap", () => {
    // 2026-03-08 02:00 → 03:00 in Chicago. 00:00–08:00 local is only 7 real hours.
    expect(minutesBetween(atLocal("2026-03-08", 0, CHI), atLocal("2026-03-08", 480, CHI))).toBe(420);
  });

  it("counts real elapsed time across fall-back", () => {
    // 2026-11-01 02:00 → 01:00. 00:00–08:00 local is 9 real hours.
    expect(minutesBetween(atLocal("2026-11-01", 0, CHI), atLocal("2026-11-01", 480, CHI))).toBe(540);
  });

  it("makes DST weeks 167 and 169 hours long", () => {
    const spring = weekInterval("2026-03-02", CHI); // Mon, contains Sun Mar 8
    expect(minutesBetween(spring.start, spring.end)).toBe(167 * 60);
    const fall = weekInterval("2026-10-26", CHI); // contains Sun Nov 1
    expect(minutesBetween(fall.start, fall.end)).toBe(169 * 60);
  });

  it("reads the local date of an instant in the store's zone, not the server's", () => {
    const lateNight = new Date("2026-09-22T03:30:00Z"); // 22:30 on the 21st in Chicago
    expect(localDateOf(lateNight, CHI)).toBe("2026-09-21");
    expect(localDateOf(lateNight, "Europe/London")).toBe("2026-09-22");
  });
});
