import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo";
import { addDays, atLocal, dayOfWeek, localDateOf, overlaps, weekDates, weekStartOf } from "@/domain/time";

const TZ = "America/Chicago";
const WEEK_STARTS_ON = 1;

const STORES = [
  { key: "downtown", name: "Downtown", address: "120 N State St, Chicago, IL", budget: 740000 },
  { key: "riverside", name: "Riverside", address: "44 E Burlington St, Riverside, IL", budget: 620000 },
  { key: "oakpark", name: "Oak Park", address: "1010 Lake St, Oak Park, IL", budget: 600000 },
] as const;

const POSITIONS = [
  { name: "Cashier", color: "cashier" },
  { name: "Stock", color: "stock" },
  { name: "Floor", color: "floor" },
  { name: "Supervisor", color: "supervisor" },
] as const;

const FIRST = ["Maya", "Omar", "Priya", "Diego", "Hana", "Liam", "Zara", "Noah", "Aisha", "Ethan", "Sofia", "Kai",
  "Lena", "Mateo", "Chloe", "Ravi", "Nora", "Felix", "Yuki", "Samir", "Grace", "Leo", "Amara", "Theo", "Ines", "Owen"];
const LAST = ["Patel", "Nguyen", "Garcia", "Kim", "Okafor", "Rossi", "Chen", "Haddad", "Silva", "Novak", "Park",
  "Mensah", "Ito", "Larsen", "Costa", "Ahmed", "Dubois", "Reyes", "Walsh", "Singh", "Moreau", "Tanaka", "Adeyemi", "Berg", "Khan", "Lopez"];

// Opening hours 08:00–22:00. [startMinute, endMinute, position, breakMinutes]
const DAY_TEMPLATE: [number, number, string, number][] = [
  [480, 960, "Cashier", 30],
  [480, 960, "Stock", 30],
  [600, 1080, "Supervisor", 30],
  [660, 1140, "Floor", 30],
  [840, 1320, "Cashier", 30],
  [840, 1320, "Floor", 30],
];
const WEEKEND_EXTRA: [number, number, string, number][] = [[720, 1320, "Cashier", 30]];

/** Small deterministic PRNG so every reset produces the same demo. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

export interface SeedResult {
  weekStart: string;
  users: number;
  shifts: number;
}

/** Wipes every table except non-demo users (and their auth rows), then rebuilds the demo org. */
export async function resetDemoData(db: PrismaClient, opts: { now?: Date; adminEmail?: string } = {}): Promise<SeedResult> {
  const now = opts.now ?? new Date();
  const rand = rng(20260927);
  const password = await hashPassword(process.env.DEMO_PASSWORD ?? "demo-password-local-only");

  await db.$transaction([
    db.notification.deleteMany(),
    db.auditLog.deleteMany(),
    db.swapRequest.deleteMany(),
    db.conflictOverride.deleteMany(),
    db.shift.deleteMany(),
    db.scheduleWeek.deleteMany(),
    db.overtimeApproval.deleteMany(),
    db.timeOffRequest.deleteMany(),
    db.availability.deleteMany(),
    db.payRate.deleteMany(),
    db.employeeLocation.deleteMany(),
    db.managerAssignment.deleteMany(),
    db.position.deleteMany(),
    db.user.deleteMany({ where: { isDemo: true } }), // cascades sessions + accounts
    db.location.deleteMany(),
    db.organization.deleteMany(),
  ]);

  const org = await db.organization.create({ data: { name: "Northwind Goods" } });
  const stores: { key: string; name: string; id: string; positions: Record<string, string> }[] = [];
  for (const s of STORES) {
    const loc = await db.location.create({ data: { orgId: org.id, name: s.name, timezone: TZ, address: s.address, weeklyBudgetCents: s.budget } });
    const positions = Object.fromEntries(
      await Promise.all(
        POSITIONS.map(async (p) => [p.name, (await db.position.create({ data: { locationId: loc.id, ...p } })).id] as const),
      ),
    );
    stores.push({ ...s, id: loc.id, positions });
  }

  const today = localDateOf(now, TZ);
  const thisWeek = weekStartOf(today, WEEK_STARTS_ON);
  const rateFrom = addDays(thisWeek, -56);

  type Person = { id: string; name: string; stores: number[]; unavailable: [number, number, number][] };
  const people: Person[] = [];
  let userCount = 0;

  async function createUser(data: {
    email: string; name: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE"; rateCents?: number; isDemo?: boolean;
  }) {
    const id = randomUUID();
    await db.user.create({
      data: {
        id, email: data.email, name: data.name, role: data.role, status: "ACTIVE",
        emailVerified: true, isDemo: data.isDemo ?? true,
        accounts: data.isDemo === false ? undefined : {
          create: { id: randomUUID(), accountId: id, providerId: "credential", password },
        },
        payRates: data.rateCents
          ? { create: { hourlyRateCents: data.rateCents, effectiveFrom: new Date(rateFrom) } }
          : undefined,
      },
    });
    userCount++;
    return id;
  }

  await createUser({ email: `admin@${DEMO_EMAIL_DOMAIN}`, name: "Alex Rivera", role: "ADMIN" });
  if (opts.adminEmail) {
    const existing = await db.user.findUnique({ where: { email: opts.adminEmail } });
    if (existing) await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" } });
    else await createUser({ email: opts.adminEmail, name: "Owner", role: "ADMIN", isDemo: false });
  }

  const managerNames = ["Jordan Blake", "Sam Whitfield", "Riley Osei"];
  for (const [i, store] of stores.entries()) {
    const email = i === 0 ? `manager@${DEMO_EMAIL_DOMAIN}` : `manager.${store.key}@${DEMO_EMAIL_DOMAIN}`;
    const id = await createUser({ email, name: managerNames[i], role: "MANAGER", rateCents: 2800 });
    await db.managerAssignment.create({ data: { userId: id, locationId: store.id } });
  }

  // 8 regulars per store, plus 2 floaters who work Downtown and Riverside. The first floater
  // is the "Employee" demo login, so it shows the multi-store view.
  let n = 0;
  const addPerson = async (storeIdx: number[], email?: string) => {
    const name = `${FIRST[n % FIRST.length]} ${LAST[(n * 7) % LAST.length]}`;
    n++;
    const rate = 1500 + Math.floor(rand() * 10) * 100;
    const id = await createUser({ email: email ?? `${name.toLowerCase().replace(" ", ".")}@${DEMO_EMAIL_DOMAIN}`, name, role: "EMPLOYEE", rateCents: rate });
    await db.employeeLocation.createMany({
      data: storeIdx.map((s, k) => ({ userId: id, locationId: stores[s].id, isHome: k === 0 })),
    });
    // ~1 in 3 people are students: unavailable weekday mornings.
    const unavailable: [number, number, number][] = [];
    if (rand() < 0.33) for (const d of [1, 2, 3, 4]) unavailable.push([d, 0, 780]);
    if (rand() < 0.25) unavailable.push([0, 0, 1440]); // no Sundays
    if (unavailable.length) {
      await db.availability.createMany({
        data: unavailable.map(([d, s, e]) => ({
          userId: id, dayOfWeek: d, startMinute: s, endMinute: e, kind: "UNAVAILABLE" as const,
          effectiveFrom: new Date(rateFrom),
        })),
      });
    }
    const p = { id, name, stores: storeIdx, unavailable };
    people.push(p);
    return p;
  };

  const demoEmployee = await addPerson([0, 1], `employee@${DEMO_EMAIL_DOMAIN}`);
  demoEmployee.unavailable = []; // keep the demo login schedulable
  await db.availability.deleteMany({ where: { userId: demoEmployee.id } });
  await addPerson([1, 0]);
  for (const [s] of stores.entries()) for (let i = 0; i < 8; i++) await addPerson([s]);

  // ── Shifts: 2 past weeks + this week published, next week draft ──
  const weeks = [-14, -7, 0, 7].map((d) => addDays(thisWeek, d));
  const booked = new Map<string, { start: Date; end: Date }[]>();
  const minutes = new Map<string, number>(); // `${userId}|${week}`
  const shifts: {
    scheduleWeekId: string; locationId: string; userId: string | null; positionId: string;
    startsAt: Date; endsAt: Date; breakMinutes: number;
  }[] = [];

  const isUnavailable = (p: Person, date: string, s: number, e: number) =>
    p.unavailable.some(([d, us, ue]) => d === dayOfWeek(date) && s < ue && us < e);

  for (const week of weeks) {
    for (const [si, store] of stores.entries()) {
      const sw = await db.scheduleWeek.create({
        data: {
          locationId: store.id, weekStart: new Date(week),
          status: week > thisWeek ? "DRAFT" : "PUBLISHED",
          publishedAt: week > thisWeek ? null : new Date(atLocal(addDays(week, -4), 600, TZ)),
        },
      });
      const pool = people.filter((p) => p.stores.includes(si));
      for (const date of weekDates(week)) {
        const dow = dayOfWeek(date);
        const slots = dow === 0 || dow === 6 ? [...DAY_TEMPLATE, ...WEEKEND_EXTRA] : DAY_TEMPLATE;
        for (const [s, e, pos, brk] of slots) {
          const start = atLocal(date, s, TZ);
          const end = atLocal(date, e, TZ);
          const len = e - s - brk;
          const candidates = pool
            .filter((p) => !isUnavailable(p, date, s, e))
            .filter((p) => !(booked.get(p.id) ?? []).some((b) => overlaps(b.start, b.end, start, end)))
            .filter((p) => (minutes.get(`${p.id}|${week}`) ?? 0) + len <= 38 * 60)
            .sort((a, b) => (minutes.get(`${a.id}|${week}`) ?? 0) - (minutes.get(`${b.id}|${week}`) ?? 0) || rand() - 0.5);
          const who = candidates[0];
          shifts.push({
            scheduleWeekId: sw.id, locationId: store.id, userId: who?.id ?? null,
            positionId: store.positions[pos], startsAt: start, endsAt: end, breakMinutes: brk,
          });
          if (who) {
            booked.set(who.id, [...(booked.get(who.id) ?? []), { start, end }]);
            minutes.set(`${who.id}|${week}`, (minutes.get(`${who.id}|${week}`) ?? 0) + len);
          }
        }
      }
    }
  }

  // ── Deliberate showcase problems in next week's Downtown draft ──
  const nextWeek = addDays(thisWeek, 7);
  const downtownDraft = shifts.filter((s) => s.locationId === stores[0].id && localDateOf(s.startsAt, TZ) >= nextWeek);
  // 1. Overtime: give one Downtown regular extra shifts until they pass 40h.
  const otPerson = people.find((p) => p.stores[0] === 0 && p.id !== demoEmployee.id && p.unavailable.length === 0);
  if (otPerson) {
    for (const s of downtownDraft.filter((x) => x.userId !== otPerson.id)) {
      const key = `${otPerson.id}|${nextWeek}`;
      if ((minutes.get(key) ?? 0) > 40 * 60) break;
      const mine = booked.get(otPerson.id) ?? [];
      if (mine.some((b) => overlaps(b.start, b.end, s.startsAt, s.endsAt))) continue;
      const prev = s.userId;
      if (prev) {
        booked.set(prev, (booked.get(prev) ?? []).filter((b) => b.start !== s.startsAt));
        minutes.set(`${prev}|${nextWeek}`, (minutes.get(`${prev}|${nextWeek}`) ?? 0) - (s.endsAt.getTime() - s.startsAt.getTime()) / 60000 + s.breakMinutes);
      }
      s.userId = otPerson.id;
      booked.set(otPerson.id, [...mine, { start: s.startsAt, end: s.endsAt }]);
      minutes.set(key, (minutes.get(key) ?? 0) + (s.endsAt.getTime() - s.startsAt.getTime()) / 60000 - s.breakMinutes);
    }
  }
  // 2. Availability clash: a student put on a weekday-morning shift.
  const student = people.find((p) => p.stores[0] === 0 && p.unavailable.some(([d]) => d === 2));
  const tuesdayOpen = downtownDraft.find((s) => dayOfWeek(localDateOf(s.startsAt, TZ)) === 2 && s.userId && s.userId !== student?.id);
  if (student && tuesdayOpen && !(booked.get(student.id) ?? []).some((b) => overlaps(b.start, b.end, tuesdayOpen.startsAt, tuesdayOpen.endsAt))) {
    tuesdayOpen.userId = student.id;
  }
  // 3. One open shift left for managers to fill.
  const friClose = downtownDraft.find((s) => dayOfWeek(localDateOf(s.startsAt, TZ)) === 5 && s.userId && s.userId !== otPerson?.id);
  if (friClose) friClose.userId = null;

  await db.shift.createMany({ data: shifts });

  // ── Requests ──
  const empThisWeek = await db.shift.findFirst({
    where: { userId: demoEmployee.id, startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
  });
  const coworker = people.find((p) => p.id !== demoEmployee.id && p.stores.includes(0));
  if (empThisWeek && coworker) {
    await db.swapRequest.create({
      data: {
        shiftId: empThisWeek.id, requesterId: demoEmployee.id, targetUserId: coworker.id,
        message: "Family thing that evening. Could you cover?",
      },
    });
  }
  const someone = people.find((p) => p.stores[0] === 0 && p.id !== otPerson?.id && p.id !== demoEmployee.id);
  if (someone) {
    await db.timeOffRequest.create({
      data: {
        userId: someone.id, reason: "Cousin's wedding",
        startsAt: atLocal(addDays(nextWeek, 4), 0, TZ), endsAt: atLocal(addDays(nextWeek, 6), 0, TZ),
      },
    });
  }
  await db.timeOffRequest.create({
    data: {
      userId: demoEmployee.id, reason: "Dentist", status: "APPROVED",
      startsAt: atLocal(addDays(thisWeek, 14), 0, TZ), endsAt: atLocal(addDays(thisWeek, 15), 0, TZ),
    },
  });

  return { weekStart: thisWeek, users: userCount, shifts: shifts.length };
}
