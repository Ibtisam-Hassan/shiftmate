import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDemoData } from "@/server/demo/seed";
import { ForbiddenError } from "@/server/authz/policy";
import { addPayRate, createPerson, listTeam, setPersonStatus, updatePerson } from "@/server/services/people";
import { actorFor } from "./actors";

const NOW = new Date("2026-09-23T15:00:00Z");

beforeEach(async () => {
  await resetDemoData(db, { now: NOW });
});

async function store(name: string) {
  return db.location.findFirstOrThrow({ where: { name } });
}

describe("people: manager scope", () => {
  it("lists only their own store's people", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const team = await listTeam(mgr);
    const downtown = await store("Downtown");
    for (const p of team) {
      const inStore = p.locations.some((l) => l.id === downtown.id) || p.managedLocation?.id === downtown.id;
      expect(inStore, p.name).toBe(true);
    }
  });

  it("ignores a request to list another store and falls back to their own", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const riverside = await store("Riverside");
    const team = await listTeam(mgr, { locationId: riverside.id });
    expect(team.every((p) => !p.locations.length || p.locations.some((l) => l.name === "Downtown") || p.managedLocation?.name === "Downtown")).toBe(true);
  });

  it("creates employees only at their own store, whatever the input says", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const riverside = await store("Riverside");
    const { id } = await createPerson(mgr, {
      name: "New Hire", email: "new.hire@example.com", role: "EMPLOYEE", locationIds: [riverside.id], hourlyRate: 17,
    });
    const created = await db.user.findUniqueOrThrow({ where: { id }, include: { locations: true, payRates: true } });
    expect(created.locations.map((l) => l.locationId)).toEqual([mgr.managedLocationId]);
    expect(created.status).toBe("INVITED");
    expect(created.payRates[0].hourlyRateCents).toBe(1700);
  });

  it("cannot create a manager or admin", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    await expect(createPerson(mgr, { name: "X", email: "x@example.com", role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cannot edit, pay or deactivate someone who only works at another store", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const riverside = await store("Riverside");
    const outsider = await db.user.findFirstOrThrow({
      where: { role: "EMPLOYEE", locations: { every: { locationId: riverside.id } } },
    });
    const input = { name: "Hacked", email: outsider.email, role: "EMPLOYEE" as const, locationIds: [riverside.id] };
    await expect(updatePerson(mgr, outsider.id, input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addPayRate(mgr, outsider.id, { hourlyRate: 99, effectiveFrom: "2026-09-21" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setPersonStatus(mgr, outsider.id, "DEACTIVATED")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cannot change a shared employee's stores or role", async () => {
    const mgr = await actorFor("manager@demo.shiftmate.app");
    const shared = await actorFor("employee@demo.shiftmate.app"); // Downtown + Riverside
    await updatePerson(mgr, shared.id, {
      name: "Renamed", email: shared.email, role: "ADMIN", locationIds: [mgr.managedLocationId!],
    });
    const after = await actorFor(shared.email);
    expect(after.name).toBe("Renamed");
    expect(after.role).toBe("EMPLOYEE");
    expect(after.memberLocationIds.sort()).toEqual(shared.memberLocationIds.sort());
  });
});

describe("people: admin", () => {
  it("promotes an employee to manager of a store", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const riverside = await store("Riverside");
    const emp = await db.user.findFirstOrThrow({ where: { role: "EMPLOYEE", isDemo: true, email: { not: "employee@demo.shiftmate.app" } } });
    await updatePerson(admin, emp.id, { name: emp.name, email: emp.email, role: "MANAGER", managedLocationId: riverside.id });
    const after = await db.user.findUniqueOrThrow({ where: { id: emp.id }, include: { managerOf: true } });
    expect(after.role).toBe("MANAGER");
    expect(after.managerOf?.locationId).toBe(riverside.id);
  });

  it("rejects a duplicate email with a field error", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const downtown = await store("Downtown");
    await expect(
      createPerson(admin, { name: "Dup", email: "EMPLOYEE@demo.shiftmate.app", role: "EMPLOYEE", locationIds: [downtown.id] }),
    ).rejects.toMatchObject({ fieldErrors: { email: "Already in use" } });
  });

  it("locks the demo logins' email and role", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const mgr = await actorFor("manager@demo.shiftmate.app");
    await expect(
      updatePerson(admin, mgr.id, { name: mgr.name, email: "stolen@example.com", role: "MANAGER", managedLocationId: mgr.managedLocationId }),
    ).rejects.toThrow(/locked/);
    await expect(setPersonStatus(admin, mgr.id, "DEACTIVATED")).rejects.toThrow(/can't be deactivated/);
  });

  it("deactivating someone ends their sessions and opens their future shifts", async () => {
    const admin = await actorFor("admin@demo.shiftmate.app");
    const shift = await db.shift.findFirstOrThrow({
      where: { userId: { not: null }, startsAt: { gt: new Date() }, user: { email: { notIn: ["employee@demo.shiftmate.app"] } } },
    });
    await setPersonStatus(admin, shift.userId!, "DEACTIVATED");
    expect((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).userId).toBeNull();
    expect(await db.session.count({ where: { userId: shift.userId! } })).toBe(0);
  });
});
