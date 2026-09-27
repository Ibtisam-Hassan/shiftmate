import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo";
import { FIRST, LAST, MANAGER_NAMES, STORES } from "./data";
import type { Person } from "./roster";

export interface Store { key: string; name: string; id: string; positions: Record<string, string> }

export interface SeedContext {
  db: PrismaClient;
  /** Hashed password shared by the demo logins. */
  password: string;
  rateFrom: string;
  rand: () => number;
  stores: Store[];
}

async function createUser(ctx: SeedContext, data: { email: string; name: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE"; rateCents?: number; isDemo?: boolean }) {
  const id = randomUUID();
  const demo = data.isDemo ?? true;
  await ctx.db.user.create({
    data: {
      id, email: data.email, name: data.name, role: data.role, status: "ACTIVE", emailVerified: true, isDemo: demo,
      accounts: demo ? { create: { id: randomUUID(), accountId: id, providerId: "credential", password: ctx.password } } : undefined,
      payRates: data.rateCents ? { create: { hourlyRateCents: data.rateCents, effectiveFrom: new Date(ctx.rateFrom) } } : undefined,
    },
  });
  return id;
}

async function addEmployee(ctx: SeedContext, n: number, stores: number[], email?: string): Promise<Person> {
  const name = `${FIRST[n % FIRST.length]} ${LAST[(n * 7) % LAST.length]}`;
  const rate = 1500 + Math.floor(ctx.rand() * 10) * 100;
  const id = await createUser(ctx, { email: email ?? `${name.toLowerCase().replace(" ", ".")}@${DEMO_EMAIL_DOMAIN}`, name, role: "EMPLOYEE", rateCents: rate });
  await ctx.db.employeeLocation.createMany({ data: stores.map((s, k) => ({ userId: id, locationId: ctx.stores[s].id, isHome: k === 0 })) });
  // About 1 in 3 are students (no weekday mornings); about 1 in 4 never work Sundays.
  const unavailable: [number, number, number][] = [];
  if (ctx.rand() < 0.33) for (const d of [1, 2, 3, 4]) unavailable.push([d, 0, 780]);
  if (ctx.rand() < 0.25) unavailable.push([0, 0, 1440]);
  return { id, name, stores, unavailable };
}

/** Admin, one manager per store, the demo employee (two stores), a floater and 8 regulars per store. */
export async function createPeople(ctx: SeedContext, ownerEmail?: string) {
  let count = 0;
  await createUser(ctx, { email: `admin@${DEMO_EMAIL_DOMAIN}`, name: "Alex Rivera", role: "ADMIN" });
  count++;
  if (ownerEmail) {
    const existing = await ctx.db.user.findUnique({ where: { email: ownerEmail } });
    if (existing) await ctx.db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" } });
    else { await createUser(ctx, { email: ownerEmail, name: "Owner", role: "ADMIN", isDemo: false }); count++; }
  }
  for (const [i, store] of ctx.stores.entries()) {
    const email = i === 0 ? `manager@${DEMO_EMAIL_DOMAIN}` : `manager.${STORES[i].key}@${DEMO_EMAIL_DOMAIN}`;
    const id = await createUser(ctx, { email, name: MANAGER_NAMES[i], role: "MANAGER", rateCents: 2800 });
    await ctx.db.managerAssignment.create({ data: { userId: id, locationId: store.id } });
    count++;
  }

  let n = 0;
  const demoEmployee = await addEmployee(ctx, n++, [0, 1], `employee@${DEMO_EMAIL_DOMAIN}`);
  demoEmployee.unavailable = []; // the demo login must stay schedulable
  const people = [demoEmployee, await addEmployee(ctx, n++, [1, 0])];
  for (const s of ctx.stores.keys()) for (let i = 0; i < 8; i++) people.push(await addEmployee(ctx, n++, [s]));

  await ctx.db.availability.createMany({
    data: people.flatMap((p) => p.unavailable.map(([d, s, e]) => ({
      userId: p.id, dayOfWeek: d, startMinute: s, endMinute: e, kind: "UNAVAILABLE" as const, effectiveFrom: new Date(ctx.rateFrom),
    }))),
  });
  return { people, demoEmployee, count: count + people.length };
}
