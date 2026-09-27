"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Role } from "@/server/authz/policy";
import type { TeamMember } from "@/server/services/people";
import { savePersonAction } from "./actions";
import { StorePicker } from "./store-picker";

interface Loc { id: string; name: string }

function Field({ id, label, error, hint, children }: {
  id: string; label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function PersonDialog({ locations, actorRole, person, trigger }: {
  locations: Loc[]; actorRole: Role; person?: TeamMember; trigger?: React.ReactNode;
}) {
  const isAdmin = actorRole === "ADMIN";
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<Role>(person?.role ?? "EMPLOYEE");
  const [storeIds, setStoreIds] = useState<string[]>(
    person?.locations.map((l) => l.id) ?? (isAdmin ? [] : locations.map((l) => l.id)),
  );
  const [homeId, setHomeId] = useState<string | undefined>(person?.locations.find((l) => l.isHome)?.id ?? locations[0]?.id);
  const [managedId, setManagedId] = useState<string | undefined>(person?.managedLocation?.id);

  function submit(form: FormData) {
    setErrors({});
    start(async () => {
      const res = await savePersonAction(person?.id ?? null, {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        role,
        locationIds: role === "EMPLOYEE" ? storeIds : [],
        homeLocationId: role === "EMPLOYEE" ? (storeIds.includes(homeId ?? "") ? homeId : storeIds[0]) : null,
        managedLocationId: role === "MANAGER" ? managedId : null,
        hourlyRate: person || !form.get("hourlyRate") ? undefined : Number(form.get("hourlyRate")),
      });
      if (res.ok) {
        toast.success(person ? "Saved." : "Person added. They can sign in with their email.");
        setOpen(false);
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus /> Add person</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{person ? `Edit ${person.name}` : "Add person"}</DialogTitle>
          <DialogDescription>
            {person ? "Changes apply right away." : "They sign in with this email; no password to set."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Full name" error={errors.name}>
              <Input id="name" name="name" defaultValue={person?.name} required autoComplete="off" aria-invalid={!!errors.name} />
            </Field>
            <Field id="phone" label="Phone (optional)" error={errors.phone}>
              <Input id="phone" name="phone" type="tel" defaultValue={person?.phone ?? ""} autoComplete="off" />
            </Field>
          </div>
          <Field id="email" label="Email" error={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={person?.email} required autoComplete="off" aria-invalid={!!errors.email} />
          </Field>

          {isAdmin && (
            <Field id="role" label="Role">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Store manager</SelectItem>
                  <SelectItem value="ADMIN">Admin (all stores)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {isAdmin && role === "MANAGER" && (
            <Field id="managed" label="Store they run" error={errors.managedLocationId}>
              <Select value={managedId} onValueChange={setManagedId}>
                <SelectTrigger id="managed" className="w-full"><SelectValue placeholder="Pick a store" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          {isAdmin && role === "EMPLOYEE" && (
            <StorePicker locations={locations} storeIds={storeIds} setStoreIds={setStoreIds} homeId={homeId} setHomeId={setHomeId} error={errors.locationIds} />
          )}

          {!person && role !== "ADMIN" && (
            <Field id="hourlyRate" label="Hourly rate (USD)" error={errors.hourlyRate} hint="Used for labor cost. You can change it later.">
              <Input id="hourlyRate" name="hourlyRate" type="number" step="0.25" min="7.25" max="250" placeholder="17.50" />
            </Field>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {person ? "Save changes" : "Add person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
