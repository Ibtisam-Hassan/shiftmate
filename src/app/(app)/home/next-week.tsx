import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Dashboard } from "@/server/services/dashboard";
import { CoverageStrip } from "../schedule/coverage-strip";
import { dayLabel } from "../schedule/format";

/** Next week at a glance: a coverage strip per day and what stands between the draft and publishing. */
export function NextWeek({ d }: { d: Dashboard }) {
  const b = d.nextWeek;
  const warnings = b.shifts.flatMap((s) => s.conflicts).filter((c) => c.severity === "warn" && !c.overridden).length;
  const gaps = Object.values(b.coverage).reduce((a, c) => a + c.gaps.length, 0);
  const open = b.shifts.filter((s) => !s.userId).length;
  const blockers = b.blockers.conflicts + b.blockers.overtime.length;
  const href = `/schedule?store=${d.store.id}&week=${b.weekStart}`;
  if (!b.shifts.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Next week has no shifts yet.</p>
        <Button asChild><Link href={href}>Start next week</Link></Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-7 gap-2">
        {b.days.map((day) => (
          <div key={day} className="grid gap-1">
            <p className="text-xs"><span className="font-numeric text-xl leading-none">{dayLabel(day).num}</span> {dayLabel(day).dow}</p>
            <CoverageStrip hours={b.coverage[day].hours} gaps={b.coverage[day].gaps} min={b.rules.minCoverage} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ul className="grid gap-1 text-sm">
          <li>{blockers ? <span className="font-semibold text-danger">{blockers} {blockers === 1 ? "thing blocks" : "things block"} publishing.</span> : "Nothing blocks publishing."}</li>
          <li>{warnings + gaps} to check: {warnings} {warnings === 1 ? "warning" : "warnings"} on shifts, {gaps} short-staffed {gaps === 1 ? "stretch" : "stretches"}.</li>
          <li>{open} open {open === 1 ? "shift" : "shifts"}.</li>
        </ul>
        <Button asChild variant={b.status === "PUBLISHED" ? "outline" : "default"}>
          <Link href={href}>{b.status === "PUBLISHED" ? "See next week" : "Open the draft"}</Link>
        </Button>
      </div>
    </div>
  );
}
