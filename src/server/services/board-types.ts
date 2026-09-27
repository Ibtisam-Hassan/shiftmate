import type { Conflict } from "@/domain/conflicts";
import type { CoverageHour } from "@/domain/coverage";
import type { LaborSummary } from "@/domain/labor";

/** What the schedule page gets for one store-week. Times are ISO strings so it can cross to the client. */

export interface BoardShift {
  id: string;
  userId: string | null;
  positionId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  notes: string | null;
  day: string;
  /** Local minutes after midnight of `day`; `endMin` may pass 1440 for overnight shifts. */
  startMin: number;
  endMin: number;
  paidMinutes: number;
  costCents: number | null;
  overtimeMinutes: number;
  conflicts: Pick<Conflict, "kind" | "severity" | "detail" | "overridden" | "relatedShiftId">[];
}

export interface BoardPerson {
  id: string;
  name: string;
  isMember: boolean;
  rateCents: number | null;
  weekMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: boolean;
  /** Most-worked position here over the last 8 weeks (stable row grouping). */
  mainPositionId: string | null;
}

export interface Busy {
  userId: string;
  day: string;
  startMin: number;
  endMin: number;
  label: string;
}

export interface Board {
  location: { id: string; name: string; timezone: string; weeklyBudgetCents: number | null; openMinute: number; closeMinute: number };
  locations: { id: string; name: string }[];
  weekStart: string;
  thisWeek: string;
  days: string[];
  status: "NONE" | "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  canEdit: boolean;
  /** Employees can't see a draft week at all. */
  hidden: boolean;
  rules: { overtimeThresholdMinutes: number; overtimeMultiplierPercent: number; minRestMinutes: number; minCoverage: number };
  positions: { id: string; name: string; color: string }[];
  people: BoardPerson[];
  shifts: BoardShift[];
  elsewhere: Busy[];
  unavailable: Busy[];
  timeOff: { userId: string; day: string }[];
  coverage: Record<string, { hours: CoverageHour[]; gaps: [number, number][] }>;
  labor: (LaborSummary & { lastWeek: { scheduledMinutes: number; totalCents: number } | null }) | null;
  blockers: { conflicts: number; overtime: { userId: string; overtimeMinutes: number }[] };
}
