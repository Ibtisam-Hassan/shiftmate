import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/authz/policy";
import { resetDemoData } from "@/server/demo/seed";
import { getBoard } from "@/server/services/board";
import { approveOvertime, keepAnyway } from "@/server/services/approvals";
import { createShift, moveShift } from "@/server/services/shifts";
import { copyLastWeek, publishWeek } from "@/server/services/week";
import { actorFor } from "./actors";

const NOW = new Date("2026-09-23T15:00:00Z"); // Wed; this week starts 09-21, next week's draft is 09-28
const NEXT = "2026-09-28";

beforeEach(async () => {
  await resetDemoData(db, { now: NOW });
});

const downtown = () => db.location.findFirstOrThrow({ where: { name: "Downtown" } });
const riverside = () => db.location.findFirstOrThrow({ where: { name: "Riverside" } });

describe("board", () => {
  it("shows the manager next week's draft with the planted problems", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const b = await getBoard(mgr, (await downtown()).id, NEXT, NOW);
    expect(b.status).toBe("DRAFT");
    expect(b.canEdit).toBe(true);
    expect(b.blockers.overtime.length).toBeGreaterThan(0);
    expect(b.shifts.some((s) => s.conflicts.some((c) => c.kind === "UNAVAILABLE"))).toBe(true);
    expect(b.shifts.some((s) => s.userId === null)).toBe(true);
    expect(b.labor?.totalCents).toBeGreaterThan(0);
    expect(b.location.weeklyBudgetCents).toBe(740000);
  });

  it("refuses a manager another store's board", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    await expect(getBoard(mgr, (await db.location.findFirstOrThrow({ where: { name: "Oak Park" } })).id, NEXT, NOW)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("hides drafts from employees and never shows them pay", async () => {
    const emp = await actorFor("employee@demo.shiftmate.app");
    const draft = await getBoard(emp, (await downtown()).id, NEXT, NOW);
    expect(draft.hidden).toBe(true);
    expect(draft.shifts).toEqual([]);
    const published = await getBoard(emp, (await downtown()).id, "2026-09-21", NOW);
    expect(published.hidden).toBe(false);
    expect(published.shifts.length).toBeGreaterThan(0);
    expect(published.labor).toBeNull();
    expect(published.people.every((p) => p.rateCents === null)).toBe(true);
    expect(published.shifts.every((s) => s.costCents === null && s.conflicts.length === 0)).toBe(true);
  });

  it("shows another store's booking as busy, not as a shift here", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const b = await getBoard(mgr, (await downtown()).id, "2026-09-21", NOW);
    const emp = await actorFor("employee@demo.shiftmate.app");
    const rv = await riverside();
    const hasRiverside = await db.shift.count({ where: { userId: emp.id, locationId: rv.id, startsAt: { gte: new Date("2026-09-21T05:00:00Z"), lt: new Date("2026-09-28T05:00:00Z") } } });
    expect(b.elsewhere.filter((e) => e.userId === emp.id)).toHaveLength(hasRiverside);
    if (hasRiverside) expect(b.elsewhere.find((e) => e.userId === emp.id)!.label).toMatch(/^Riverside /);
  });
});

describe("editing shifts", () => {
  it("creates an overnight shift and refuses a double-booking with a friendly error", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const loc = await downtown();
    const user = await db.user.create({ data: { id: "night-owl", name: "Night Owl", email: "owl@test.local", status: "ACTIVE", locations: { create: { locationId: loc.id } } } });
    const { id } = await createShift(mgr, loc.id, { date: "2026-10-02", start: "20:00", end: "02:00", userId: user.id, breakMinutes: 30 });
    const s = await db.shift.findUniqueOrThrow({ where: { id } });
    expect((s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000).toBe(6);
    await expect(createShift(mgr, loc.id, { date: "2026-10-03", start: "01:00", end: "05:00", userId: user.id }))
      .rejects.toThrow("already has a shift at that time");
  });

  it("stops a manager editing another store's shifts", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const shift = await db.shift.findFirstOrThrow({ where: { locationId: (await riverside()).id } });
    await expect(moveShift(mgr, shift.id, { date: "2026-10-01", userId: null })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("moves a shift to another day and person at the same wall-clock time, clearing old overrides", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const loc = await downtown();
    const b = await getBoard(mgr, loc.id, NEXT, NOW);
    const flagged = b.shifts.find((s) => s.conflicts.some((c) => c.kind === "UNAVAILABLE"))!;
    await keepAnyway(mgr, flagged.id, { kind: "UNAVAILABLE", reason: "Agreed with them" });
    const open = b.shifts.find((s) => s.userId === null)!;
    await db.shift.delete({ where: { id: open.id } }); // free a person-day to move into
    const target = await db.user.create({ data: { id: "mover", name: "Mover", email: "mover@test.local", status: "ACTIVE", locations: { create: { locationId: loc.id } } } });
    await moveShift(mgr, flagged.id, { date: "2026-10-03", userId: target.id });
    const after = await getBoard(mgr, loc.id, NEXT, NOW);
    const moved = after.shifts.find((s) => s.id === flagged.id)!;
    expect([moved.day, moved.startMin, moved.userId]).toEqual(["2026-10-03", flagged.startMin, target.id]);
    expect(await db.conflictOverride.count({ where: { shiftId: flagged.id } })).toBe(0);
  });
});

describe("publishing", () => {
  it("is blocked by unapproved overtime, then publishes and notifies everyone scheduled", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const loc = await downtown();
    await expect(publishWeek(mgr, loc.id, NEXT)).rejects.toThrow(/overtime/);
    const b = await getBoard(mgr, loc.id, NEXT, NOW);
    for (const o of b.blockers.overtime) await approveOvertime(mgr, o.userId, NEXT);
    const { notified } = await publishWeek(mgr, loc.id, NEXT);
    expect(notified).toBeGreaterThan(5);
    expect(await db.notification.count({ where: { type: "schedule.published" } })).toBe(notified);
    const after = await getBoard(mgr, loc.id, NEXT, NOW);
    expect(after.status).toBe("PUBLISHED");
  });

  it("warns people when a published week changes", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const loc = await downtown();
    const shift = await db.shift.findFirstOrThrow({ where: { locationId: loc.id, userId: { not: null }, scheduleWeek: { status: "PUBLISHED" } } });
    const newbie = await db.user.create({ data: { id: "newbie", name: "Newbie", email: "newbie@test.local", status: "ACTIVE", locations: { create: { locationId: loc.id } } } });
    const tz = loc.timezone;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(shift.startsAt);
    await moveShift(mgr, shift.id, { date, userId: newbie.id });
    const notes = await db.notification.findMany({ where: { type: "schedule.changed" } });
    expect(notes.map((n) => n.userId).sort()).toEqual([shift.userId!, newbie.id].sort());
  });

  it("copies last week into an empty week, opening shifts people can no longer take", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const loc = await downtown();
    const weekAfter = "2026-10-05";
    const r = await copyLastWeek(mgr, loc.id, weekAfter);
    const nextCount = await db.shift.count({ where: { locationId: loc.id, scheduleWeek: { weekStart: new Date(`${NEXT}T00:00:00Z`) } } });
    expect(r.assigned + r.opened).toBe(nextCount);
    await expect(copyLastWeek(mgr, loc.id, weekAfter)).rejects.toThrow(/already has shifts/);
  });
});
