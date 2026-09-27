import { localDateOf, localMinuteOf } from "./time";

/** The one way ShiftMate writes times in sentences: "9:00 am", "1:30 pm". Grid cells use compact "9–5". */
export function clockTime(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function clockRange(startMin: number, endMin: number): string {
  return `${clockTime(startMin)} to ${clockTime(endMin)}`;
}

/** Compact "9–5" or "9:30–5": hours only when on the hour, no am/pm. */
export function compactRange(startMin: number, endMin: number): string {
  const f = (min: number) => {
    const m = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60) % 12 || 12;
    return m % 60 ? `${h}:${String(m % 60).padStart(2, "0")}` : String(h);
  };
  return `${f(startMin)}–${f(endMin)}`;
}

/** "Mon, Sep 28" for a store-local calendar date. */
export function dayName(date: string, long = false): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: long ? "long" : "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

/** "Sep 28". */
export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** An instant in a store's zone: "Mon, Sep 28, 9:00 am". */
export function whenAt(instant: Date, tz: string): string {
  return `${dayName(localDateOf(instant, tz))}, ${clockTime(localMinuteOf(instant, tz))}`;
}
