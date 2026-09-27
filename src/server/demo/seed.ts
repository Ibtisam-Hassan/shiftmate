import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, localDateOf, weekStartOf } from "@/domain/time";
import { POSITIONS, STORES, TZ, WEEK_STARTS_ON, rng } from "./data";
import { type SeedContext, type Store, createPeople } from "./people";
import { planWeeks } from "./plan";
import { plantProblems, plantRequests } from "./showcase";

export interface SeedResult { weekStart: string; users: number; shifts: number }

async function wipe(db: PrismaClient) {
  // Order matters: children before parents. Non-demo users (and their logins) survive.
  await db.$transaction([
    db.notification.deleteMany(), db.auditLog.deleteMany(), db.swapRequest.deleteMany(), db.conflictOverride.deleteMany(),
    db.shift.deleteMany(), db.scheduleWeek.deleteMany(), db.overtimeApproval.deleteMany(), db.timeOffRequest.deleteMany(),
    db.availability.deleteMany(), db.payRate.deleteMany(), db.employeeLocation.deleteMany(), db.managerAssignment.deleteMany(),
    db.position.deleteMany(), db.user.deleteMany({ where: { isDemo: true } }), db.location.deleteMany(), db.organization.deleteMany(),
  ]);
}

async function createStores(db: PrismaClient): Promise<Store[]> {
  const org = await db.organization.create({ data: { name: "Northwind Goods" } });
  const stores: Store[] = [];
  for (const s of STORES) {
    const loc = await db.location.create({ data: { orgId: org.id, name: s.name, timezone: TZ, address: s.address, weeklyBudgetCents: s.budget } });
    const positions: Record<string, string> = {};
    for (const p of POSITIONS) positions[p.name] = (await db.position.create({ data: { locationId: loc.id, ...p } })).id;
    stores.push({ key: s.key, name: s.name, id: loc.id, positions });
  }
  return stores;
}

/** Wipes the demo and rebuilds it relative to `now`, so the demo always looks current. */
export async function resetDemoData(db: PrismaClient, opts: { now?: Date; adminEmail?: string } = {}): Promise<SeedResult> {
  const now = opts.now ?? new Date();
  const thisWeek = weekStartOf(localDateOf(now, TZ), WEEK_STARTS_ON);
  await wipe(db);
  const ctx: SeedContext = {
    db, stores: await createStores(db), rand: rng(20260927), rateFrom: addDays(thisWeek, -56),
    password: await hashPassword(process.env.DEMO_PASSWORD ?? "demo-password-local-only"),
  };
  const { people, demoEmployee, count } = await createPeople(ctx, opts.adminEmail);
  const { rows, roster } = await planWeeks(ctx, people, thisWeek);
  plantProblems(rows, roster, people, demoEmployee, ctx.stores[0].id, addDays(thisWeek, 7));
  await db.shift.createMany({
    data: rows.map(({ scheduleWeekId, locationId, userId, positionId, startsAt, endsAt, breakMinutes }) =>
      ({ scheduleWeekId, locationId, userId, positionId, startsAt, endsAt, breakMinutes })),
  });
  await plantRequests(ctx, people, demoEmployee, thisWeek, now);
  return { weekStart: thisWeek, users: count, shifts: rows.length };
}
