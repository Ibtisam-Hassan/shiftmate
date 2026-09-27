import Link from "next/link";
import type { Dashboard } from "@/server/services/dashboard";

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? " am" : " pm"}`;

/** One sentence that says what needs attention, with links to each part. */
export function Summary({ d }: { d: Dashboard }) {
  const gaps = d.todayCoverage?.gaps.filter(([, end]) => end * 60 > d.nowMinute) ?? [];
  const waiting = d.pendingTimeOff.length + d.swapsForManager.length + d.overtimeToApprove.length;
  const draft = d.nextWeek.status !== "PUBLISHED";
  const blockers = d.nextWeek.blockers.conflicts + d.nextWeek.blockers.overtime.length;
  const parts: React.ReactNode[] = [];
  if (gaps.length) {
    parts.push(<Link key="gap" href="#today" className="font-semibold underline underline-offset-2">
      Too few people {gaps.map(([a, b]) => `${hourLabel(a)} to ${hourLabel(b)}`).join(" and ")} today
    </Link>);
  }
  if (waiting) parts.push(<Link key="wait" href="#waiting" className="font-semibold underline underline-offset-2">{waiting} {waiting === 1 ? "thing waits" : "things wait"} on you</Link>);
  if (draft) {
    parts.push(<span key="draft"><Link href={`/schedule?store=${d.store.id}&week=${d.nextWeek.weekStart}`} className="font-semibold underline underline-offset-2">next week is still a draft</Link>
      {blockers ? ` with ${blockers} ${blockers === 1 ? "thing that blocks" : "things that block"} publishing` : ""}</span>);
  }
  if (!parts.length) return <p className="text-lg">Everything is covered today, nothing waits on you, and next week is published.</p>;
  return (
    <p className="text-lg leading-relaxed">
      {parts.map((p, i) => <span key={i}>{i > 0 && (i === parts.length - 1 ? ", and " : ", ")}{p}</span>)}.
    </p>
  );
}
