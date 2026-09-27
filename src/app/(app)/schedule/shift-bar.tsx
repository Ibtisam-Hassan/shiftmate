"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check, GripVertical, TriangleAlert, X } from "lucide-react";
import { forwardRef } from "react";
import type { BoardShift } from "@/server/services/board";
import { cn } from "@/lib/utils";
import { POSITION_BG, POSITION_SHORT, range, spokenRange, trackPosition } from "./format";

export type ShiftStatus = "block" | "warn" | "kept" | null;

export function statusOf(shift: BoardShift): ShiftStatus {
  if (shift.conflicts.some((c) => c.severity === "block")) return "block";
  if (shift.conflicts.some((c) => c.severity === "warn" && !c.overridden)) return "warn";
  if (shift.conflicts.some((c) => c.overridden)) return "kept";
  return null;
}

const STATUS_WORD: Record<Exclude<ShiftStatus, null>, string> = { block: "Conflict", warn: "Check", kept: "Kept" };

interface Props {
  shift: BoardShift;
  position?: { name: string; color: string };
  draggable: boolean;
  selected?: boolean;
  onOpen: () => void;
}

/**
 * One shift in a day cell: the time and role on top, the bar on the 6a–11p track below.
 * The cell is a size container, so labels shrink with the cell, not the window.
 */
export const ShiftBar = forwardRef<HTMLButtonElement, Props>(function ShiftBar({ shift, position, draggable, selected, onOpen }, ref) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: shift.id, disabled: !draggable, data: { shift } });
  const status = statusOf(shift);
  const { left, width } = trackPosition(shift.startMin, shift.endMin);
  const color = POSITION_BG[position?.color ?? ""] ?? "bg-muted-foreground";
  const problems = shift.conflicts.filter((c) => !c.overridden).map((c) => c.detail).join(" ");
  const label = `${spokenRange(shift.startMin, shift.endMin)}${position ? `, ${position.name}` : ""}${problems ? `. ${problems}` : ""}`;

  return (
    <button
      ref={(el) => {
        setNodeRef(el);
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={problems || undefined}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "group/bar relative block w-full rounded-[4px] px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-45",
        selected && "ring-2 ring-ring",
      )}
    >
      <span className="flex items-baseline justify-between gap-1 text-xs">
        <span className="font-semibold tabular-nums">
          <span className="@min-[176px]:hidden">{range(shift.startMin, shift.endMin, true)}</span>
          <span className="hidden @min-[176px]:inline">{range(shift.startMin, shift.endMin)}</span>
        </span>
        {status && status !== "kept" ? (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", status === "block" ? "text-danger" : "text-warning")}>
            {status === "block" ? <X className="size-3.5 rounded-full bg-danger p-0.5 text-white" strokeWidth={3} aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
            <span className="hidden @min-[176px]:inline">{STATUS_WORD[status]}</span>
          </span>
        ) : status === "kept" ? (
          <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Check className="size-3 rounded-full border" aria-hidden /><span className="hidden @min-[176px]:inline">Kept</span></span>
        ) : position ? (
          <span className="truncate text-muted-foreground">
            <span className="@min-[176px]:hidden">{POSITION_SHORT[position.name] ?? position.name}</span>
            <span className="hidden @min-[176px]:inline">{position.name}</span>
          </span>
        ) : null}
      </span>
      <span className="relative mt-1 block h-1.5 rounded-full bg-track">
        <span
          className={cn(
            "absolute inset-y-0 rounded-full",
            color,
            status === "block" && "outline-2 outline-offset-1 outline-danger",
            status === "warn" && "bg-[repeating-linear-gradient(-45deg,transparent_0_3px,var(--warning)_3px_5px)]",
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </span>
      {draggable && (
        <GripVertical className="absolute top-0.5 -left-2.5 size-3 text-muted-foreground opacity-0 transition-opacity group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100" aria-hidden />
      )}
    </button>
  );
});
