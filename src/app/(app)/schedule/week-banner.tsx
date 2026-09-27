import type { Board } from "@/server/services/board";

/** Draft (caution tape) or published record, above the grid. */
export function WeekBanner({ board, recipients }: { board: Board; recipients: number }) {
  if (!board.canEdit) return null;
  if (board.status === "PUBLISHED") {
    const when = board.publishedAt && new Date(board.publishedAt).toLocaleString("en-US", {
      timeZone: board.location.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
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
      </span>
    </div>
  );
}
