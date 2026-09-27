import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDemoData } from "@/server/demo/seed";

const NOW = new Date("2026-09-23T15:00:00Z"); // a Wednesday

beforeAll(async () => {
  await resetDemoData(db, { now: NOW });
});

async function someShift() {
  const shift = await db.shift.findFirstOrThrow({ where: { userId: { not: null } }, orderBy: { startsAt: "asc" } });
  return shift;
}

describe("database invariants", () => {
  it("refuses an overlapping shift for the same employee, even at another store", async () => {
    const s = await someShift();
    const other = await db.location.findFirstOrThrow({ where: { id: { not: s.locationId } } });
    const week = await db.scheduleWeek.findFirstOrThrow({ where: { locationId: other.id } });
    await expect(
      db.shift.create({
        data: {
          scheduleWeekId: week.id, locationId: other.id, userId: s.userId,
          startsAt: new Date(s.startsAt.getTime() + 60 * 60_000), endsAt: new Date(s.endsAt.getTime() + 60 * 60_000),
        },
      }),
    ).rejects.toThrow(/shift_no_overlap|exclusion|conflicting key/i);
  });

  it("allows back-to-back shifts (touching ends are not an overlap)", async () => {
    const s = await someShift();
    const user = await db.user.create({ data: { id: "b2b-test", name: "Back To Back", email: "b2b@test.local" } });
    const t0 = new Date("2030-01-07T14:00:00Z");
    const t1 = new Date("2030-01-07T18:00:00Z");
    const t2 = new Date("2030-01-07T22:00:00Z");
    const base = { scheduleWeekId: s.scheduleWeekId, locationId: s.locationId, userId: user.id };
    await db.shift.create({ data: { ...base, startsAt: t0, endsAt: t1 } });
    await expect(db.shift.create({ data: { ...base, startsAt: t1, endsAt: t2 } })).resolves.toBeTruthy();
    await db.shift.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  });

  it("refuses a shift that ends before it starts", async () => {
    const s = await someShift();
    await expect(
      db.shift.create({ data: { scheduleWeekId: s.scheduleWeekId, locationId: s.locationId, startsAt: s.endsAt, endsAt: s.startsAt } }),
    ).rejects.toThrow(/shift_ends_after_start|check constraint/i);
  });
});

describe("demo seed", () => {
  it("creates 3 stores, managers for each, and an employee who works two stores", async () => {
    expect(await db.location.count()).toBe(3);
    expect(await db.managerAssignment.count()).toBe(3);
    const emp = await db.user.findUniqueOrThrow({
      where: { email: "employee@demo.shiftmate.app" },
      include: { locations: true },
    });
    expect(emp.locations).toHaveLength(2);
  });

  it("is idempotent", async () => {
    const before = await db.shift.count();
    await resetDemoData(db, { now: NOW });
    expect(await db.shift.count()).toBe(before);
  });
});
