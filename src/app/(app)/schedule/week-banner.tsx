import { whenAt } from "@/domain/format";
import type { Board } from "@/server/services/board";

/** Draft (caution tape) or published record, above the grid. */
export function WeekBanner({ board, recipients, blocker }: { board: Board; recipients: number; blocker: string | null }) {
  if (!board.canEdit) return null;
  if (board.status === "PUBLISHED") {
    const when = board.publishedAt && whenAt(new Date(board.publishedAt), board.location.timezone);
    return (
      <div className="rounded-md bg-accent/60 px-3 py-2 text-sm">
        <span className="font-semibold">Published</span> {when}. Changes send an in-app update to the people affected.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-md bg-warning-bg py-2 pr-3 text-sm">
      <span className="caution-tape w-3 self-stretch" aria-hidden />
      <span>
        <span className="font-semibold">Draft.</span> Staff can&apos;t see this week until you publish.
        {" "}Publishing notifies {recipients} {recipients === 1 ? "person" : "people"} in the app.
        {blocker && <> <span className="font-semibold">{blocker}</span> <a href="#review" className="underline underline-offset-2">See the review</a></>}
      </span>
    </div>
  );
}
