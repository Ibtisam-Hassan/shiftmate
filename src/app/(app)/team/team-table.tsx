"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { Role } from "@/server/authz/policy";
import type { TeamMember } from "@/server/services/people";
import { HoursMeter } from "../schedule/hours-meter";
import { RowActions, StatusBadge } from "./row-actions";

const ROLE_LABEL = { ADMIN: "Admin", MANAGER: "Manager", EMPLOYEE: "Employee" } as const;

export function TeamTable({ team, locations, actorRole, actorId }: {
  team: TeamMember[]; locations: { id: string; name: string }[]; actorRole: Role; actorId: string;
}) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return team.filter((p) =>
      (showInactive || p.status !== "DEACTIVATED") &&
      (!needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle)));
  }, [team, q, showInactive]);
  const inactive = team.filter((p) => p.status === "DEACTIVATED").length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-8" aria-label="Search team" />
        </div>
        <p className="text-sm text-muted-foreground">{rows.length} of {team.length} people</p>
        {inactive > 0 && (
          <Button variant="link" size="sm" className="ml-auto" onClick={() => setShowInactive((s) => !s)}>
            {showInactive ? "Hide deactivated" : `Show ${inactive} deactivated`}
          </Button>
        )}
      </div>

      <div className="max-w-5xl overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-right">Rate</TableHead>
              <TableHead>Stores</TableHead>
              <TableHead className="w-56">This week</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className={cn(p.status === "DEACTIVATED" && "opacity-60")}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">{p.name} <StatusBadge status={p.status} /></div>
                  <div className="text-xs text-muted-foreground">{p.role === "EMPLOYEE" ? p.email : `${ROLE_LABEL[p.role]} · ${p.email}`}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.hourlyRateCents ? `${formatCents(p.hourlyRateCents)}/h` : <span className="text-muted-foreground">Not set</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {p.managedLocation ? `Runs ${p.managedLocation.name}` : p.role === "ADMIN" ? <span className="text-muted-foreground">All stores</span>
                    : p.locations.map((l) => `${l.name}${l.isHome && p.locations.length > 1 ? " (home)" : ""}`).join(", ")}
                </TableCell>
                <TableCell>
                  {p.role === "EMPLOYEE" ? <HoursMeter minutes={p.weekMinutes} threshold={p.overtimeLimitMinutes} /> : null}
                </TableCell>
                <TableCell><RowActions person={p} locations={locations} actorRole={actorRole} actorId={actorId} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {q ? `Nobody matches "${q}".` : "No one here yet. Add the first person."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
