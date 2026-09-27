"use client";

import { ChevronRight, CircleDashed, Loader2, TriangleAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Board, BoardShift } from "@/server/services/board";
import { approveOvertimeAction, makeOpenAction } from "./actions";
import { dayLabel, hours, range } from "./format";

interface Item {
  key: string;
  tone: "block" | "ot" | "warn" | "gap" | "open" | "kept";
  title: string;
  detail: string;
  focus?: string;
  actions: React.ReactNode[];
}

const EDGE: Record<Item["tone"], string> = {
  block: "border-l-danger", ot: "border-l-overtime", warn: "border-l-warning", gap: "border-l-danger", open: "border-l-muted-foreground border-dashed", kept: "border-l-border",
};

function ActionButton({ label, primary, run }: { label: string; primary?: boolean; run: () => Promise<{ ok: boolean; error?: string }> }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant={primary ? "default" : "outline"} disabled={pending}
      onClick={() => start(async () => { const r = await run(); if (!r.ok) toast.error(r.error); })}>
      {pending && <Loader2 className="animate-spin" />}{label}
    </Button>
  );
}

export function buildItems(board: Board, openShift: (s: BoardShift) => void, addForGap: (day: string, from: number, to: number) => void): { sections: [string, Item[]][]; blockCount: number } {
  const name = (id: string | null) => board.people.find((p) => p.id === id)?.name ?? "Someone";
  const first = (id: string | null) => name(id).split(" ")[0];
  const block: Item[] = [];
  const check: Item[] = [];
  const open: Item[] = [];
  const kept: Item[] = [];
  const seenPairs = new Set<string>();

  for (const s of board.shifts) {
    for (const c of s.conflicts) {
      if (c.kind === "OVERLAP") {
        const pair = [s.id, c.relatedShiftId].sort().join("|");
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        block.push({
          key: `o-${pair}`, tone: "block", focus: s.id,
          title: `${first(s.userId)} is double-booked ${dayLabel(s.day).dow}`,
          detail: `${range(s.startMin, s.endMin)}. ${c.detail}`,
          actions: [
            <Button key="r" size="sm" onClick={() => openShift(s)}>Reassign…</Button>,
            <ActionButton key="o" label="Make it an open shift" run={() => makeOpenAction(s.id)} />,
          ],
        });
      } else if (c.overridden) {
        kept.push({ key: `k-${s.id}-${c.kind}`, tone: "kept", focus: s.id, title: `${first(s.userId)} ${dayLabel(s.day).dow} ${range(s.startMin, s.endMin)}`, detail: c.detail, actions: [] });
      } else {
        check.push({
          key: `w-${s.id}-${c.kind}`, tone: "warn", focus: s.id,
          title: `${first(s.userId)} ${dayLabel(s.day).dow} ${range(s.startMin, s.endMin)}`, detail: c.detail,
          actions: [<Button key="d" size="sm" variant="outline" onClick={() => openShift(s)}>Review…</Button>],
        });
      }
    }
  }
  for (const o of board.blockers.overtime) {
    const p = board.people.find((x) => x.id === o.userId)!;
    block.push({
      key: `ot-${o.userId}`, tone: "ot",
      title: `${p.name.split(" ")[0]} is at ${hours(p.weekMinutes)}`,
      detail: `${hours(o.overtimeMinutes)} overtime this week needs your approval.`,
      actions: [<ActionButton key="a" primary label={`Approve ${hours(o.overtimeMinutes)} overtime`} run={() => approveOvertimeAction(o.userId, board.weekStart)} />],
    });
  }
  for (const [day, cov] of Object.entries(board.coverage)) {
    for (const [a, b] of cov.gaps) {
      const lbl = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
      check.push({
        key: `g-${day}-${a}`, tone: "gap",
        title: `${dayLabel(day).dow} ${lbl(a)}–${lbl(b)} is short-staffed`,
        detail: `Fewer than ${board.rules.minCoverage} people on the floor while open.`,
        actions: [<Button key="add" size="sm" variant="outline" onClick={() => addForGap(day, a * 60, b * 60)}>Add a shift</Button>],
      });
    }
  }
  for (const s of board.shifts.filter((x) => !x.userId)) {
    const pos = board.positions.find((p) => p.id === s.positionId)?.name;
    open.push({
      key: `open-${s.id}`, tone: "open", focus: s.id,
      title: `${dayLabel(s.day).dow} ${range(s.startMin, s.endMin)}${pos ? ` ${pos}` : ""}`, detail: "Nobody is on this shift yet.",
      actions: [<Button key="as" size="sm" variant="outline" onClick={() => openShift(s)}>Assign…</Button>],
    });
  }
  return {
    blockCount: block.length,
    sections: ([["Blocks publishing", block], ["Check before publishing", check], ["Open shifts", open], ["Kept anyway", kept]] as [string, Item[]][]).filter(([, l]) => l.length),
  };
}

function ToneIcon({ tone }: { tone: Item["tone"] }) {
  if (tone === "block") return <X className="size-4 rounded-full bg-danger p-0.5 text-white" strokeWidth={3} aria-hidden />;
  if (tone === "ot") return <span className="rounded-sm bg-overtime px-1 text-[10px] font-bold text-white" aria-hidden>OT</span>;
  if (tone === "open") return <CircleDashed className="size-4 text-muted-foreground" aria-hidden />;
  if (tone === "kept") return <span className="text-muted-foreground" aria-hidden>✓</span>;
  return <TriangleAlert className={cn("size-4", tone === "gap" ? "text-danger" : "text-warning")} aria-hidden />;
}

export function ReviewRail({ sections, blockCount, onFocus }: { sections: [string, Item[]][]; blockCount: number; onFocus: (shiftId: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = sections.reduce((a, [, l]) => a + l.length, 0);
  if (collapsed) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} className="sticky top-16 flex w-12 flex-col items-center gap-2 self-start rounded-[3px] bg-card py-4 shadow-[0_1px_0_var(--border)]" aria-label="Open the publish review">
        <ChevronRight className="size-4 rotate-180" aria-hidden />
        {blockCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-danger text-xs font-bold text-white">{blockCount}</span>}
        <span className="text-xs font-medium [writing-mode:vertical-rl]">Ready to publish?</span>
      </button>
    );
  }
  return (
    <aside aria-label="Publish review" className="sticky top-16 max-h-[calc(100dvh-5rem)] w-[272px] shrink-0 self-start overflow-y-auto rounded-[3px] bg-card p-4 shadow-[0_1px_0_var(--border)] 2xl:w-[300px]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 font-numeric text-[24px] leading-none">
          Ready to publish?
          {blockCount > 0 && <span className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-danger font-sans text-xs font-bold text-white">{blockCount}</span>}
        </h2>
        <Button size="icon" variant="outline" className="size-7" onClick={() => setCollapsed(true)} aria-label="Collapse the publish review"><ChevronRight /></Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {blockCount ? `${blockCount} ${blockCount === 1 ? "thing blocks" : "things block"} publishing. Click an item to find it on the grid.` : total ? "Nothing blocks publishing. Worth a look:" : "All clear. Nothing needs you before publishing."}
      </p>
      {sections.map(([title, items]) => (
        <section key={title} className="mt-4 grid gap-2">
          <h3 className="text-xs font-semibold">{title}</h3>
          {items.map((it) => (
            <div key={it.key} className={cn("grid gap-2 rounded-md border border-l-4 p-3", EDGE[it.tone])}>
              <button type="button" className="flex gap-2 text-left" onClick={() => it.focus && onFocus(it.focus)} disabled={!it.focus}>
                <span className="mt-0.5"><ToneIcon tone={it.tone} /></span>
                <span>
                  <span className="block text-sm font-semibold">{it.title}</span>
                  <span className="block text-xs text-muted-foreground">{it.detail}</span>
                </span>
              </button>
              {it.actions.length > 0 && <div className="flex flex-wrap gap-2 pl-6">{it.actions}</div>}
            </div>
          ))}
        </section>
      ))}
    </aside>
  );
}
