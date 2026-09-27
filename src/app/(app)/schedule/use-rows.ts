import { useMemo } from "react";
import type { Board, BoardShift } from "@/server/services/board";
import type { Filters } from "./board-toolbar";

const ROLE_ORDER = ["Supervisor", "Cashier", "Stock", "Floor"];

/** The people rows: grouped by the role they usually work (stable across weeks), then by name, then filtered. */
export function useRows(board: Board, shifts: BoardShift[], filters: Filters) {
  return useMemo(() => {
    const posById = new Map(board.positions.map((p) => [p.id, p]));
    const mainRole = (userId: string, fallback: string | null) => {
      if (fallback) return posById.get(fallback);
      // New people have no history yet: use this week's most-worked position.
      const counts = new Map<string, number>();
      for (const s of shifts) {
        if (s.userId === userId && s.positionId) counts.set(s.positionId, (counts.get(s.positionId) ?? 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return top ? posById.get(top) : undefined;
    };
    const rank = (name?: string) => {
      const i = name ? ROLE_ORDER.indexOf(name) : -1;
      return i < 0 ? 99 : i;
    };
    const needle = filters.query.trim().toLowerCase();

    return board.people
      .map((p) => ({
        ...p,
        pos: mainRole(p.id, p.mainPositionId),
        hasProblems:
          shifts.some((s) => s.userId === p.id && s.conflicts.some((c) => !c.overridden)) ||
          (p.overtimeMinutes > 0 && !p.overtimeApproved),
      }))
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .filter((p) => !filters.positionId || p.pos?.id === filters.positionId)
      .filter((p) => !filters.problemsOnly || p.hasProblems)
      .sort((a, b) => rank(a.pos?.name) - rank(b.pos?.name) || a.name.localeCompare(b.name));
  }, [board.people, board.positions, shifts, filters]);
}

export type Row = ReturnType<typeof useRows>[number];
