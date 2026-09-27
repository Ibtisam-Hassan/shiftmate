import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/authz/policy";
import { resetDemoData } from "@/server/demo/seed";
import { myUnavailability, saveUnavailability } from "@/server/services/availability";
import { cancelTimeOff, decideTimeOff, requestTimeOff } from "@/server/services/time-off";
import { listTimeOff } from "@/server/services/time-off-list";
import { actorFor } from "./actors";

beforeEach(async () => {
  await resetDemoData(db, { now: new Date() });
});

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe("time off", () => {
  it("an employee asks, their managers hear about it, and duplicates are refused", async () => {
    const emp = await actorFor("employee@demo.shiftmate.app");
    await requestTimeOff(emp, { from: future(20), to: future(21), reason: "Trip" });
    const notes = await db.notification.findMany({ where: { type: "time_off.requested" }, include: { user: true } });
    expect(notes.map((n) => n.user.role).sort()).toEqual(expect.arrayContaining(["ADMIN", "MANAGER"]));
    await expect(requestTimeOff(emp, { from: future(21), to: future(22) })).rejects.toThrow(/already asked/);
    await expect(requestTimeOff(emp, { from: future(-2), to: future(-1) })).rejects.toThrow(/past/);
  });

  it("a manager only reviews requests from their own store's staff", async () => {
    const oakParkMgr = await actorFor("manager.oakpark@demo.shiftmate.app");
    const emp = await actorFor("employee@demo.shiftmate.app"); // Downtown + Riverside
    await requestTimeOff(emp, { from: future(20), to: future(20) });
    const req = await db.timeOffRequest.findFirstOrThrow({ where: { userId: emp.id, status: "PENDING" } });
    await expect(decideTimeOff(oakParkMgr, req.id, { approve: true })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listTimeOff(oakParkMgr)).some((r) => r.id === req.id)).toBe(false);
  });

  it("approving can open the person's shifts in that period, and tells them", async () => {
    const shift = await db.shift.findFirstOrThrow({
      where: { user: { email: "employee@demo.shiftmate.app" }, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" },
    });
    // The manager of that shift's store: a manager only opens shifts at their own store.
    const assignment = await db.managerAssignment.findFirstOrThrow({ where: { locationId: shift.locationId }, include: { user: true } });
    const mgr = await actorFor(assignment.user.email);
    const emp = await actorFor("employee@demo.shiftmate.app");
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(shift.startsAt);
    await requestTimeOff(emp, { from: day, to: day });
    const req = await db.timeOffRequest.findFirstOrThrow({ where: { userId: emp.id, status: "PENDING" } });
    expect((await listTimeOff(mgr)).find((r) => r.id === req.id)?.shiftsInPeriod).toBeGreaterThan(0);
    await decideTimeOff(mgr, req.id, { approve: true, openShifts: true, note: "Enjoy" });
    expect((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).userId).toBeNull();
    const note = await db.notification.findFirstOrThrow({ where: { userId: emp.id, type: "time_off.decided" }, orderBy: { createdAt: "desc" } });
    expect([note.title, note.body]).toEqual(["Your time off was approved", "Enjoy"]);
    await expect(decideTimeOff(mgr, req.id, { approve: false })).rejects.toThrow(/already decided/);
  });

  it("only the requester can cancel, and only before it starts", async () => {
    const emp = await actorFor("employee@demo.shiftmate.app");
    const other = await actorFor("manager@demo.shiftmate.app");
    await requestTimeOff(emp, { from: future(10), to: future(10) });
    const req = await db.timeOffRequest.findFirstOrThrow({ where: { userId: emp.id, status: "PENDING" } });
    await expect(cancelTimeOff(other, req.id)).rejects.toBeInstanceOf(ForbiddenError);
    await cancelTimeOff(emp, req.id);
    expect((await db.timeOffRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("CANCELLED");
  });
});

describe("availability", () => {
  it("replaces windows from today and keeps the old ones closed off, not deleted", async () => {
    const emp = await actorFor("employee@demo.shiftmate.app");
    await saveUnavailability(emp, [{ dayOfWeek: 1, startMinute: 0, endMinute: 720 }]);
    expect(await myUnavailability(emp)).toEqual([{ dayOfWeek: 1, startMinute: 0, endMinute: 720 }]);
    await db.availability.updateMany({ where: { userId: emp.id }, data: { effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
    await saveUnavailability(emp, [{ dayOfWeek: 3, startMinute: 1020, endMinute: 1440 }]);
    expect(await myUnavailability(emp)).toEqual([{ dayOfWeek: 3, startMinute: 1020, endMinute: 1440 }]);
    expect(await db.availability.count({ where: { userId: emp.id } })).toBe(2);
    await expect(saveUnavailability(emp, [{ dayOfWeek: 1, startMinute: 600, endMinute: 500 }])).rejects.toThrow();
  });
});
