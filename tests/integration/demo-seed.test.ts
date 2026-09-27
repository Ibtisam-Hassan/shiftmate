import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDemoData } from "@/server/demo/seed";
import { getBoard } from "@/server/services/board";
import { myUpcomingShifts } from "@/server/services/my-shifts";
import { actorFor } from "./actors";

// One moment on each day of a week, late in the day when "this week" has little left.
const NIGHTS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 8, 21 + i, 3, 30)));

describe("demo seed, whatever day it runs", () => {
  it.each(NIGHTS.map((d) => [d.toISOString(), d] as const))("gives the demo employee upcoming shifts and the manager a draft with problems (%s)", async (_, now) => {
    await resetDemoData(db, { now });
    const emp = await actorFor("employee@demo.shiftmate.app");
    expect((await myUpcomingShifts(emp, now)).length).toBeGreaterThanOrEqual(3);

    const mgr = await actorFor("manager@demo.shiftmate.app");
    const loc = await db.location.findFirstOrThrow({ where: { name: "Downtown" } });
    const thisWeek = await getBoard(mgr, loc.id, undefined, now);
    const next = await getBoard(mgr, loc.id, new Date(new Date(`${thisWeek.weekStart}T12:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10), now);
    expect(next.status).toBe("DRAFT");
    expect(next.blockers.overtime.length).toBeGreaterThan(0);
    expect(next.shifts.some((s) => s.conflicts.some((c) => c.kind === "UNAVAILABLE"))).toBe(true);
    expect(next.shifts.some((s) => !s.userId)).toBe(true);
  });
});
