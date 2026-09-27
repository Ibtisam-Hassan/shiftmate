import { clockRange } from "@/domain/format";
import { TRACK_END, TRACK_START } from "@/domain/coverage";

/** "9:00" or "9" (compact); 12-hour clock without am/pm, like a paper rota. */
export function clock(min: number, compact = false): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60) % 12 || 12;
  const mm = m % 60;
  if (compact && mm === 0) return String(h);
  return `${h}:${String(mm).padStart(2, "0")}`;
}

export function range(startMin: number, endMin: number, compact = false) {
  return `${clock(startMin, compact)}–${clock(endMin, compact)}`;
}

/** Spoken form for labels and tooltips: "9:00 am to 5:00 pm". */
export const spokenRange = clockRange;

export function hhmm(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Bar geometry on the 6a–11p day track, as percentages. */
export function trackPosition(startMin: number, endMin: number) {
  const span = TRACK_END - TRACK_START;
  const s = Math.max(TRACK_START, Math.min(TRACK_END, startMin));
  const e = Math.max(TRACK_START, Math.min(TRACK_END, endMin));
  return { left: ((s - TRACK_START) / span) * 100, width: Math.max(2, ((e - s) / span) * 100) };
}

export function hours(minutes: number) {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h} h`;
}

export function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    num: d.getUTCDate(),
    dow: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    long: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

export function weekTitle(weekStart: string) {
  return new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export const POSITION_BG: Record<string, string> = {
  cashier: "bg-pos-cashier", stock: "bg-pos-stock", floor: "bg-pos-floor", supervisor: "bg-pos-supervisor",
};
export const POSITION_TEXT: Record<string, string> = {
  cashier: "text-pos-cashier", stock: "text-pos-stock", floor: "text-pos-floor", supervisor: "text-pos-supervisor",
};
export const POSITION_SHORT: Record<string, string> = { Cashier: "Cash", Supervisor: "Sup" };
