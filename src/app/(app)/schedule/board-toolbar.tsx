"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { POSITION_BG } from "./format";

export interface Filters {
  positionId: string | null;
  problemsOnly: boolean;
  query: string;
}

export function BoardToolbar({ positions, filters, onChange }: {
  positions: { id: string; name: string; color: string }[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const chips = [{ id: null, name: "Everyone", color: "" }, ...positions];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Show</span>
      {chips.map((p) => {
        const on = filters.positionId === p.id;
        return (
          <button key={p.id ?? "all"} type="button" aria-pressed={on} onClick={() => onChange({ ...filters, positionId: p.id })}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm", on ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}>
            {p.color && <span className={cn("h-1.5 w-3 rounded-full", POSITION_BG[p.color])} aria-hidden />}
            {p.name}
          </button>
        );
      })}
      <label className="ml-2 flex items-center gap-2 text-sm">
        <Switch aria-label="Problems only" checked={filters.problemsOnly} onCheckedChange={(v) => onChange({ ...filters, problemsOnly: v })} />
        Problems only
      </label>
      <div className="relative ml-auto w-48">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={filters.query} onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Find a person" className="h-8 pl-8" aria-label="Find a person" />
      </div>
    </div>
  );
}
