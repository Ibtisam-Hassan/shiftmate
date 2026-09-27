"use client";

import { ChevronLeft, ChevronRight, ListChecks, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { addDays } from "@/domain/time";
import { cn } from "@/lib/utils";
import type { Board } from "@/server/services/board";
import { publishWeekAction } from "./actions";
import { weekTitle } from "./format";

function publishBlocker(board: Board, shiftCount: number) {
  if (!shiftCount) return "Add shifts to publish.";
  const { conflicts, overtime } = board.blockers;
  const todo = [
    conflicts && `fix ${conflicts} double-booked shift${conflicts > 1 ? "s" : ""}`,
    overtime.length && `approve overtime for ${overtime.length} ${overtime.length > 1 ? "people" : "person"}`,
  ].filter(Boolean);
  return todo.length ? `Can't publish yet: ${todo.join(" and ")}.` : null;
}

function WeekNav({ board }: { board: Board }) {
  const href = (week?: string) => `?store=${board.location.id}${week ? `&week=${week}` : ""}`;
  return (
    <div className="flex items-center gap-1">
      <Button asChild size="icon" variant="outline" className="size-8" aria-label="Previous week">
        <Link href={href(addDays(board.weekStart, -7))}><ChevronLeft /></Link>
      </Button>
      <Button asChild size="icon" variant="outline" className="size-8" aria-label="Next week">
        <Link href={href(addDays(board.weekStart, 7))}><ChevronRight /></Link>
      </Button>
      {board.weekStart !== board.thisWeek && (
        <Button asChild size="sm" variant="outline"><Link href={href()}>This week</Link></Button>
      )}
    </div>
  );
}

function StoreTabs({ board }: { board: Board }) {
  if (board.locations.length < 2) return null;
  return (
    <nav aria-label="Store" className="flex rounded-md bg-muted p-0.5">
      {board.locations.map((l) => {
        const here = l.id === board.location.id;
        return (
          <Link key={l.id} href={`?store=${l.id}&week=${board.weekStart}`} aria-current={here ? "page" : undefined}
            className={cn("rounded px-3 py-1 text-sm font-medium text-muted-foreground", here && "bg-card text-foreground shadow-sm")}>
            {l.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function WeekHeader({ board, shiftCount, blockCount, onAddShift, review }: {
  board: Board; shiftCount: number; blockCount: number; onAddShift: () => void; review: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const blocker = publishBlocker(board, shiftCount);
  const publish = () => start(async () => {
    const res = await publishWeekAction(board.location.id, board.weekStart);
    if (res.ok) toast.success(`Published. ${res.data.notified} people were notified in the app.`);
    else toast.error(res.error);
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="font-numeric text-4xl leading-none">Week of {weekTitle(board.weekStart)}</h1>
      <WeekNav board={board} />
      <StoreTabs board={board} />
      {board.canEdit && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAddShift}><Plus /> Add shift</Button>
          {blocker && <p className="max-w-64 text-right text-xs text-danger">{blocker}</p>}
          <Button disabled={!!blocker || pending} onClick={publish}>
            {pending && <Loader2 className="animate-spin" />}
            {board.status === "PUBLISHED" ? "Publish again" : "Publish week"}
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="xl:hidden"><ListChecks /> Review{blockCount ? ` (${blockCount})` : ""}</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] overflow-y-auto p-0">
              <SheetTitle className="sr-only">Publish review</SheetTitle>
              {review}
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}
