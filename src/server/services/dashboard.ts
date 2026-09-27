import "server-only";
import { addDays, localDateOf, localMinuteOf } from "@/domain/time";
import { type Actor, ForbiddenError, managedLocationIds } from "@/server/authz/policy";
import { recentActivity } from "./activity";
import { type Board, getBoard } from "./board";
import { reportStores } from "./labor-report";
import { listSwaps } from "./swap-list";
import { listTimeOff } from "./time-off-list";

/**
 * The manager's morning page for one store: today's floor, what waits on them, next week's draft,
 * cost against budget, overtime risk and recent changes. Built from the same board the grid uses,
 * so the numbers always match the schedule.
 */
export async function getDashboard(actor: Actor, storeId?: string, now = new Date()) {
  if (actor.role === "EMPLOYEE") throw new ForbiddenError();
  const stores = await reportStores(actor);
  const store = stores.find((s) => s.id === storeId) ?? stores[0];
  if (!store) throw new ForbiddenError();
  const tz = store.timezone;
  const today = localDateOf(now, tz);

  const thisWeek = await getBoard(actor, store.id, today, now);
  const nextWeek = await getBoard(actor, store.id, addDays(thisWeek.weekStart, 7), now);
  const scope = managedLocationIds(actor);
  const [timeOff, swaps, activity] = await Promise.all([listTimeOff(actor), listSwaps(actor), recentActivity(actor, 6)]);

  return {
    store: { id: store.id, name: store.name, timezone: tz, openMinute: store.openMinute, closeMinute: store.closeMinute },
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
    isAdmin: scope === null,
    today,
    nowMinute: localMinuteOf(now, tz),
    thisWeek,
    nextWeek,
    todayShifts: thisWeek.shifts.filter((s) => s.day === today).sort((a, b) => a.startMin - b.startMin),
    todayCoverage: thisWeek.coverage[today] ?? null,
    pendingTimeOff: timeOff.filter((r) => r.status === "PENDING"),
    swapsForManager: swaps.filter((s) => s.status === "PENDING_MANAGER"),
    overtimeToApprove: nextWeek.blockers.overtime.map((o) => ({
      ...o, name: nextWeek.people.find((p) => p.id === o.userId)?.name ?? "Someone", weekStart: nextWeek.weekStart,
    })),
    closeToOvertime: closeToOvertime(nextWeek),
    activity,
  };
}

/** People nearest the weekly limit next week, highest first. */
function closeToOvertime(board: Board) {
  const limit = board.rules.overtimeThresholdMinutes;
  return board.people
    .filter((p) => p.weekMinutes >= limit * 0.85)
    .sort((a, b) => b.weekMinutes - a.weekMinutes)
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name, minutes: p.weekMinutes, approved: p.overtimeApproved }));
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
