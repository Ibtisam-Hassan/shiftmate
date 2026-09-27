import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/authz/policy";
import { resetDemoData } from "@/server/demo/seed";
import { saveLocation, savePosition, updateOrgRules } from "@/server/services/settings";
import { actorFor } from "./actors";

beforeEach(async () => {
  await resetDemoData(db, { now: new Date("2026-09-23T15:00:00Z") });
});

describe("settings", () => {
  it("only admins change org rules and stores", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    await expect(updateOrgRules(mgr, { overtimeThresholdHours: 30, overtimeMultiplier: 2, weekStartsOn: 0, minRestHours: 0 }))
      .rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveLocation(mgr, null, { name: "Rogue", timezone: "America/Chicago" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("saves rules in minutes and percent", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    await updateOrgRules(admin, { overtimeThresholdHours: 37.5, overtimeMultiplier: 1.5, weekStartsOn: 0, minRestHours: 10 });
    const org = await db.organization.findFirstOrThrow();
    expect([org.overtimeThresholdMinutes, org.overtimeMultiplierPercent, org.weekStartsOn, org.minRestMinutes]).toEqual([2250, 150, 0, 600]);
  });

  it("locks a store's time zone once it has shifts, but allows other edits", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const loc = await db.location.findFirstOrThrow({ where: { name: "Downtown" } });
    await expect(saveLocation(admin, loc.id, { name: loc.name, timezone: "America/New_York" })).rejects.toThrow(/time zone/);
    await saveLocation(admin, loc.id, { name: "Downtown Loop", timezone: loc.timezone, weeklyBudget: 8000 });
    const after = await db.location.findUniqueOrThrow({ where: { id: loc.id } });
    expect([after.name, after.weeklyBudgetCents]).toEqual(["Downtown Loop", 800000]);
  });

  it("new stores get the four default positions; managers edit positions only at their store", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const { id } = await saveLocation(admin, null, { name: "Evanston", timezone: "America/Chicago" });
    expect(await db.position.count({ where: { locationId: id } })).toBe(4);
    const mgr = await actorFor("manager@demo.shiftmate.app");
    await expect(savePosition(mgr, id, null, { name: "Greeter", color: "floor" })).rejects.toBeInstanceOf(ForbiddenError);
    await savePosition(mgr, mgr.managedLocationId!, null, { name: "Greeter", color: "floor" });
    expect(await db.position.count({ where: { locationId: mgr.managedLocationId!, name: "Greeter" } })).toBe(1);
  });
});
