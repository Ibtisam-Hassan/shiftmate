import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/authz/policy";
import { resetDemoData } from "@/server/demo/seed";
import { cancelSwap, decideSwap, requestSwap, respondSwap } from "@/server/services/swaps";
import { actorFor } from "./actors";

beforeEach(async () => {
  await resetDemoData(db, { now: new Date() });
  await db.swapRequest.deleteMany(); // start without the seeded demo swap
  // Publish every week so there are upcoming shifts whatever day the tests run.
  await db.scheduleWeek.updateMany({ data: { status: "PUBLISHED" } });
});

/** The demo employee's next published shift at Downtown. */
async function myNextShift() {
  return db.shift.findFirstOrThrow({
    where: { user: { email: "employee@demo.shiftmate.app" }, startsAt: { gt: new Date() }, scheduleWeek: { status: "PUBLISHED" }, location: { name: "Downtown" } },
    orderBy: { startsAt: "asc" },
  });
}

async function freshCoworker(email: string) {
  const loc = await db.location.findFirstOrThrow({ where: { name: "Downtown" } });
  await db.user.create({ data: { id: email, name: `Fresh ${email}`, email, status: "ACTIVE", locations: { create: { locationId: loc.id } } } });
  return actorFor(email);
}

describe("swaps", () => {
  it("a clean cover applies as soon as the coworker accepts", async () => {
    const me = await actorFor("employee@demo.shiftmate.app");
    const buddy = await freshCoworker("buddy@test.local");
    const shift = await myNextShift();
    await requestSwap(me, { shiftId: shift.id, targetUserId: buddy.id, message: "Please?" });
    const req = await db.swapRequest.findFirstOrThrow();
    expect((await db.notification.findFirstOrThrow({ where: { userId: buddy.id } })).type).toBe("swap.requested");
    const res = await respondSwap(buddy, req.id, true);
    expect(res.status).toBe("APPROVED");
    expect((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).userId).toBe(buddy.id);
  });

  it("a swap that causes overtime waits for a manager, who can approve it", async () => {
    await db.organization.updateMany({ data: { overtimeThresholdMinutes: 60 } });
    const me = await actorFor("employee@demo.shiftmate.app");
    const buddy = await freshCoworker("ot@test.local");
    const shift = await myNextShift();
    await requestSwap(me, { shiftId: shift.id, targetUserId: buddy.id });
    const req = await db.swapRequest.findFirstOrThrow();
    const res = await respondSwap(buddy, req.id, true);
    expect(res.status).toBe("PENDING_MANAGER");
    expect(res.problems.join(" ")).toMatch(/overtime/);
    expect((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).userId).toBe(me.id);

    const oakPark = await actorFor("manager.oakpark@demo.shiftmate.app");
    await expect(decideSwap(oakPark, req.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await decideSwap(await actorFor("manager@demo.shiftmate.app"), req.id, true);
    expect((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).userId).toBe(buddy.id);
  });

  it("a trade exchanges both shifts", async () => {
    const me = await actorFor("employee@demo.shiftmate.app");
    const buddy = await freshCoworker("trade@test.local");
    const mine = await myNextShift();
    const week = await db.scheduleWeek.findUniqueOrThrow({ where: { id: mine.scheduleWeekId } });
    const theirs = await db.shift.create({
      data: { scheduleWeekId: week.id, locationId: mine.locationId, userId: buddy.id,
        startsAt: new Date(mine.startsAt.getTime() + 2 * 86_400_000), endsAt: new Date(mine.endsAt.getTime() + 2 * 86_400_000) },
    });
    const clash = await db.shift.findFirst({ where: { userId: me.id, startsAt: { lt: theirs.endsAt }, endsAt: { gt: theirs.startsAt } } });
    if (clash) await db.shift.update({ where: { id: clash.id }, data: { userId: null } });
    await requestSwap(me, { shiftId: mine.id, targetUserId: buddy.id, targetShiftId: theirs.id });
    const req = await db.swapRequest.findFirstOrThrow();
    await respondSwap(buddy, req.id, true);
    const [a, b] = await Promise.all([db.shift.findUniqueOrThrow({ where: { id: mine.id } }), db.shift.findUniqueOrThrow({ where: { id: theirs.id } })]);
    expect([a.userId, b.userId]).toEqual([buddy.id, me.id]);
  });

  it("refuses other people's shifts, and stale requests", async () => {
    const me = await actorFor("employee@demo.shiftmate.app");
    const buddy = await freshCoworker("stale@test.local");
    const shift = await myNextShift();
    await expect(requestSwap(buddy, { shiftId: shift.id, targetUserId: me.id })).rejects.toBeInstanceOf(ForbiddenError);
    await requestSwap(me, { shiftId: shift.id, targetUserId: buddy.id });
    await db.shift.update({ where: { id: shift.id }, data: { userId: null } }); // a manager opened it meanwhile
    const req = await db.swapRequest.findFirstOrThrow();
    await expect(respondSwap(buddy, req.id, true)).rejects.toThrow(/changed/);
  });

  it("the requester can cancel; a decline tells them", async () => {
    const me = await actorFor("employee@demo.shiftmate.app");
    const buddy = await freshCoworker("no@test.local");
    const shift = await myNextShift();
    await requestSwap(me, { shiftId: shift.id, targetUserId: buddy.id });
    let req = await db.swapRequest.findFirstOrThrow();
    await respondSwap(buddy, req.id, false);
    expect((await db.notification.findFirstOrThrow({ where: { userId: me.id, type: "swap.declined" } })).title).toMatch(/said no/);
    await requestSwap(me, { shiftId: shift.id, targetUserId: buddy.id });
    req = await db.swapRequest.findFirstOrThrow({ where: { status: "PENDING_COWORKER" } });
    await cancelSwap(me, req.id);
    expect((await db.swapRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("CANCELLED");
  });
});
