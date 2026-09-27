"use client";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Board, BoardShift } from "@/server/services/board";
import { ShiftBar } from "./shift-bar";
import { ShiftDetails } from "./shift-details";

/** A shift bar plus its details popover. */
export function ShiftSlot({ board, shift, selected, pulsing, onSelect, onEdit }: {
  board: Board;
  shift: BoardShift;
  selected: boolean;
  pulsing: boolean;
  onSelect: (id: string | null) => void;
  onEdit: (s: BoardShift) => void;
}) {
  const position = board.positions.find((p) => p.id === shift.positionId);
  return (
    <div data-shift={shift.id} className={cn("rounded-[5px]", pulsing && "ring-2 ring-ring motion-safe:animate-pulse")}>
      <Popover open={selected} onOpenChange={(o) => onSelect(o ? shift.id : null)}>
        <PopoverAnchor asChild>
          <div>
            <ShiftBar shift={shift} position={position} draggable={board.canEdit} selected={selected} onOpen={() => onSelect(shift.id)} />
          </div>
        </PopoverAnchor>
        <PopoverContent className="w-[340px]" align="start" side="right" collisionPadding={12}>
          <ShiftDetails board={board} shift={shift} onEdit={() => onEdit(shift)} onClose={() => onSelect(null)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
