import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/authz/policy";
import { resetDemoData } from "@/server/demo/seed";
import { recentActivity } from "@/server/services/activity";
import { createShift } from "@/server/services/shifts";
import { actorFor } from "./actors";

beforeAll(async () => {
  await resetDemoData(db, { now: new Date("2026-09-23T15:00:00Z") });
  const mgr = await actorFor("manager@demo.shiftmate.app");
  await createShift(mgr, mgr.managedLocationId!, { date: "2026-10-10", start: "09:00", end: "13:00" });
  const oak = await actorFor("manager.oakpark@demo.shiftmate.app");
  await createShift(oak, oak.managedLocationId!, { date: "2026-10-10", start: "09:00", end: "13:00" });
});

describe("activity", () => {
  it("shows a manager only their store, in plain words", async () => {
    const rows = await recentActivity(await actorFor("manager@demo.shiftmate.app"));
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ who: "Jordan Blake", what: "added a shift", store: "Downtown" });
  });

  it("shows the admin every store, and refuses employees", async () => {
    expect((await recentActivity(await actorFor("admin@demo.shiftmate.app"))).length).toBe(2);
    await expect(recentActivity(await actorFor("employee@demo.shiftmate.app"))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
