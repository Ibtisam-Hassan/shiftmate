import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/authz/policy";
import { resetDemoData } from "@/server/demo/seed";
import { getBoard } from "@/server/services/board";
import { laborReport } from "@/server/services/labor-report";
import { actorFor } from "./actors";

const NOW = new Date("2026-09-23T15:00:00Z");

beforeAll(async () => {
  await resetDemoData(db, { now: NOW });
});

describe("labor report", () => {
  it("matches the schedule's labor strip for the same store and week", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const report = await laborReport(mgr, { now: NOW });
    expect(report.stores.map((s) => s.name)).toEqual(["Downtown"]);
    const board = await getBoard(mgr, report.stores[0].id, report.thisWeek, NOW);
    const week = report.stores[0].weeks.find((w) => w.weekStart === report.thisWeek)!;
    expect(week.totalCents).toBe(board.labor!.totalCents);
    expect(week.scheduledMinutes).toBe(board.labor!.scheduledMinutes);
  });

  it("shows past overtime from the demo history", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const report = await laborReport(admin, { now: NOW });
    expect(report.stores).toHaveLength(3);
    expect(report.stores.some((s) => s.weeks.some((w) => w.overtimeCents > 0))).toBe(true);
    expect(report.people.length).toBeGreaterThan(20);
  });

  it("refuses employees", async () => {
    await expect(laborReport(await actorFor("employee@demo.shiftmate.app"))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
