import "server-only";
import { db } from "@/lib/db";
import { localDateOf, localMinuteOf, minutesBetween } from "@/domain/time";
import { paidMinutes } from "@/domain/labor";
import type { Actor } from "@/server/authz/policy";

export interface MyShift {
  id: string;
  startsAt: string;
  day: string;
  startMin: number;
  endMin: number;
  paidMinutes: number;
  breakMinutes: number;
  store: string;
  locationId: string;
  position: { name: string; color: string } | null;
  notes: string | null;
  /** Coworkers on shift at the same store at the same time. */
  with: string[];
  swapPending: boolean;
}

/** The actor's published shifts for the next two weeks, at every store. */
export async function myUpcomingShifts(actor: Actor, now = new Date()): Promise<MyShift[]> {
  const until = new Date(now.getTime() + 14 * 86_400_000);
  const shifts = await db.shift.findMany({
    where: { userId: actor.id, endsAt: { gt: now }, startsAt: { lt: until }, scheduleWeek: { status: "PUBLISHED" } },
    include: {
      location: { select: { name: true, timezone: true } },
      position: { select: { name: true, color: true } },
      swapRequests: { where: { status: { in: ["PENDING_COWORKER", "PENDING_MANAGER"] } }, select: { id: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  return Promise.all(shifts.map(async (s) => {
    const tz = s.location.timezone;
    const mates = await db.shift.findMany({
      where: { locationId: s.locationId, userId: { not: actor.id }, startsAt: { lt: s.endsAt }, endsAt: { gt: s.startsAt } },
      select: { user: { select: { name: true } } },
    });
    const startMin = localMinuteOf(s.startsAt, tz);
    return {
      id: s.id, startsAt: s.startsAt.toISOString(), day: localDateOf(s.startsAt, tz),
      startMin, endMin: startMin + minutesBetween(s.startsAt, s.endsAt),
      paidMinutes: paidMinutes(s), breakMinutes: s.breakMinutes, store: s.location.name, locationId: s.locationId,
      position: s.position, notes: s.notes, swapPending: s.swapRequests.length > 0,
      with: mates.flatMap((m) => (m.user ? [m.user.name.split(" ")[0]] : [])),
    };
  }));
}

/** Coworkers at the shift's store, with their upcoming published shifts there (for trades). */
export async function swapOptions(actor: Actor, shiftId: string) {
  const shift = await db.shift.findUnique({ where: { id: shiftId }, include: { location: true } });
  if (!shift || shift.userId !== actor.id) return [];
  const tz = shift.location.timezone;
  const people = await db.user.findMany({
    where: { id: { not: actor.id }, status: "ACTIVE", role: "EMPLOYEE", locations: { some: { locationId: shift.locationId } } },
    select: {
      id: true, name: true,
      shifts: {
        where: { locationId: shift.locationId, startsAt: { gt: new Date() }, scheduleWeek: { status: "PUBLISHED" } },
        orderBy: { startsAt: "asc" }, take: 8,
      },
    },
    orderBy: { name: "asc" },
  });
  const label = (s: { startsAt: Date; endsAt: Date }) => {
    const f = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
    const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(s.startsAt);
    return `${day}, ${f(s.startsAt)} to ${f(s.endsAt)}`;
  };
  return people.map((p) => ({ id: p.id, name: p.name, shifts: p.shifts.map((s) => ({ id: s.id, label: label(s) })) }));
}
