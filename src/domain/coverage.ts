/** The grid's day track: 6a to 11p, one column per hour. */
export const TRACK_START = 6 * 60;
export const TRACK_END = 23 * 60;
export const TRACK_HOURS = Array.from({ length: (TRACK_END - TRACK_START) / 60 }, (_, i) => TRACK_START / 60 + i);

export interface DaySpan {
  /** Minutes after local midnight of the cell's day; may run past 1440 for overnight shifts. */
  startMin: number;
  endMin: number;
}

export interface CoverageHour {
  hour: number;
  count: number;
  open: boolean;
  gap: boolean;
}

/**
 * Headcount per hour for one store-day. Someone counts for an hour if they're on shift at its
 * midpoint, so a 9:00–5:00 shift covers 9a–4p, not 5p.
 */
export function dayCoverage(
  spans: DaySpan[],
  opts: { openMinute: number; closeMinute: number; minCoverage: number },
): CoverageHour[] {
  return TRACK_HOURS.map((hour) => {
    const mid = hour * 60 + 30;
    const count = spans.filter((s) => s.startMin <= mid && mid < s.endMin).length;
    const open = hour * 60 >= opts.openMinute && (hour + 1) * 60 <= opts.closeMinute;
    return { hour, count, open, gap: open && count < opts.minCoverage };
  });
}

/** Contiguous gap hours as ranges, e.g. [[20, 21]] for "8p–9p". */
export function gapRanges(hours: CoverageHour[]): [number, number][] {
  const out: [number, number][] = [];
  for (const h of hours) {
    if (!h.gap) continue;
    const last = out.at(-1);
    if (last && last[1] === h.hour) last[1] = h.hour + 1;
    else out.push([h.hour, h.hour + 1]);
  }
  return out;
}
