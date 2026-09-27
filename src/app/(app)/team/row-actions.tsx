"use client";

import { MoreHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Role } from "@/server/authz/policy";
import type { TeamMember } from "@/server/services/people";
import { setStatusAction } from "./actions";
import { PayRateDialog } from "./pay-rate-dialog";
import { PersonDialog } from "./person-dialog";

export function StatusBadge({ status }: { status: TeamMember["status"] }) {
  if (status === "ACTIVE") return null;
  return (
    <Badge variant="outline" className={cn(status === "INVITED" ? "border-warning/40 text-warning" : "text-muted-foreground")}>
      {status === "INVITED" ? "Invited" : "Deactivated"}
    </Badge>
  );
}

export function RowActions({ person, locations, actorRole, actorId }: {
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
