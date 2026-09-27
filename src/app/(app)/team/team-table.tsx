"use client";

import { MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import type { Role } from "@/server/authz/policy";
import type { TeamMember } from "@/server/services/people";
import { setStatusAction } from "./actions";
import { PayRateDialog } from "./pay-rate-dialog";
import { PersonDialog } from "./person-dialog";

const ROLE_LABEL = { ADMIN: "Admin", MANAGER: "Manager", EMPLOYEE: "Employee" } as const;

function StatusBadge({ status }: { status: TeamMember["status"] }) {
  if (status === "ACTIVE") return null;
  return (
    <Badge variant="outline" className={cn(status === "INVITED" ? "border-warning/40 text-warning" : "text-muted-foreground")}>
      {status === "INVITED" ? "Invited" : "Deactivated"}
    </Badge>
  );
}

function RowActions({ person, locations, actorRole, actorId }: {
  person: TeamMember; locations: { id: string; name: string }[]; actorRole: Role; actorId: string;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!person.canEdit) return null;
  const deactivated = person.status === "DEACTIVATED";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${person.name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <PersonDialog
            locations={locations}
            actorRole={actorRole}
            person={person}
            trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit details</DropdownMenuItem>}
          />
          {person.role !== "ADMIN" && <DropdownMenuItem onSelect={() => setPayOpen(true)}>Change pay rate</DropdownMenuItem>}
          {person.id !== actorId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant={deactivated ? "default" : "destructive"}
                onSelect={() =>
                  start(async () => {
                    const res = await setStatusAction(person.id, deactivated ? "ACTIVE" : "DEACTIVATED");
                    if (res.ok) {
                      toast.success(deactivated ? `${person.name} can sign in again.` : `${person.name} is deactivated. Their upcoming shifts are now open shifts.`);
                    } else toast.error(res.error);
                  })
                }
              >
                {deactivated ? "Reactivate" : "Deactivate"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <PayRateDialog person={person} open={payOpen} onOpenChange={setPayOpen} />
    </>
  );
}

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

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Stores</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className={cn(p.status === "DEACTIVATED" && "opacity-60")}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">{p.name} <StatusBadge status={p.status} /></div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </TableCell>
                <TableCell>{ROLE_LABEL[p.role]}</TableCell>
                <TableCell>
                  {p.managedLocation ? (
                    <span>Runs {p.managedLocation.name}</span>
                  ) : p.role === "ADMIN" ? (
                    <span className="text-muted-foreground">All stores</span>
                  ) : (
                    <span>
                      {p.locations.map((l, i) => (
                        <span key={l.id}>
                          {i > 0 && ", "}
                          <span className={cn(l.isHome ? "font-medium" : "text-muted-foreground")}>{l.name}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.hourlyRateCents ? `${formatCents(p.hourlyRateCents)}/h` : <span className="text-muted-foreground">Not set</span>}
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
