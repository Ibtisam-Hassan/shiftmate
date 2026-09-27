"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Verdict } from "./drop-rules";

interface Props {
  id: string;
  label: string;
  children: React.ReactNode;
  verdict?: Verdict;
  isOver: boolean;
  dragging: boolean;
  /** Only the row under the pointer explains why a cell is blocked. */
  showReason: boolean;
  onAdd?: () => void;
  className?: string;
}

/** One person-day box. It is a drop target, and a size container so shift labels fit its width. */
export function GridCell({ id, label, children, verdict, isOver, dragging, showReason, onAdd, className }: Props) {
  const { setNodeRef } = useDroppable({ id, disabled: verdict?.ok === false });
  const ok = dragging && verdict?.ok;
  const blocked = dragging && verdict?.ok === false;
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      onDoubleClick={onAdd}
      className={cn(
        "@container group/cell relative min-h-[46px] border-b border-l px-2 py-1.5 transition-colors",
        ok && "bg-ring/[0.09] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ring)_55%,transparent)]",
        ok && isOver && "bg-ring/[0.16] shadow-[inset_0_0_0_2px_var(--ring)]",
        blocked && "bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,var(--card)_6px_12px)]",
        className,
      )}
    >
      {children}
      {dragging && showReason && verdict && (!verdict.ok || verdict.warn) && (
        <span className={cn("absolute right-1.5 bottom-1 text-[10.5px] font-semibold", verdict.ok ? "text-warning" : "text-muted-foreground")}>
          {verdict.ok ? `⚠ ${verdict.warn}` : `⊘ ${verdict.reason}`}
        </span>
      )}
      {onAdd && !dragging && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onAdd}
          aria-label={`Add shift, ${label}`}
          className="absolute right-1 bottom-1 grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/cell:opacity-100 hover:bg-accent focus-visible:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
