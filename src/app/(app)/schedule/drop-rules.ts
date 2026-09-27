import { type CollisionDetection, pointerWithin, rectIntersection } from "@dnd-kit/core";
import type { Board, BoardShift } from "@/server/services/board";
import { range } from "./format";

const OPEN_ROW = "open";

export const cellId = (userId: string | null, day: string) => `${userId ?? OPEN_ROW}|${day}`;

export function parseCell(id: string) {
  const [u, day] = id.split("|");
  return { userId: u === OPEN_ROW ? null : u, day };
}

// Drop where the pointer is, not where the drag card overlaps most (the card hangs off the
// cursor and would land a row away). Keyboard drags have no pointer, so they use overlap.
export const dropTarget: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export type Verdict = { ok: true; warn?: string } | { ok: false; reason: string };

type Span = { startMin: number; endMin: number };
const overlaps = (a: Span, b: Span) => a.startMin < b.endMin && b.startMin < a.endMin;

/** Same rules as the server, so the grid can mark cells during a drag. The server still re-checks. */
export function judgeDrop(board: Board, shifts: BoardShift[], s: BoardShift, target: { userId: string | null; day: string }): Verdict {
  const { userId, day } = target;
  if (!userId) return { ok: true };
  const busy = shifts.find((x) => x.id !== s.id && x.userId === userId && x.day === day && overlaps(x, s));
  if (busy) return { ok: false, reason: `Busy ${range(busy.startMin, busy.endMin)}` };
  const away = board.elsewhere.find((e) => e.userId === userId && e.day === day && overlaps(e, s));
  if (away) return { ok: false, reason: `Busy: ${away.label}` };
  if (board.timeOff.some((t) => t.userId === userId && t.day === day)) return { ok: true, warn: "Time off" };
  if (board.unavailable.some((u) => u.userId === userId && u.day === day && overlaps(u, s))) return { ok: true, warn: "Unavailable" };
  return { ok: true };
}

export function verdictsFor(board: Board, shifts: BoardShift[], dragged: BoardShift | null) {
  const m = new Map<string, Verdict>();
  if (!dragged) return m;
  for (const day of board.days) {
    m.set(cellId(null, day), { ok: true });
    for (const p of board.people) m.set(cellId(p.id, day), judgeDrop(board, shifts, dragged, { userId: p.id, day }));
  }
  return m;
}
