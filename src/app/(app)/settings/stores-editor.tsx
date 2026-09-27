"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/domain/pay";
import { saveLocationAction } from "./actions";
import { FieldError, formToRecord } from "./form-bits";

interface Store { id: string; name: string; timezone: string; address: string; weeklyBudgetCents: number | null; hasShifts: boolean }

const US_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];

function StoreDialog({ store, trigger }: { store?: Store; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tz, setTz] = useState(store?.timezone ?? "America/Chicago");
  const zones = US_ZONES.includes(tz) ? US_ZONES : [tz, ...US_ZONES];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{store ? `Edit ${store.name}` : "Add store"}</DialogTitle>
          <DialogDescription>New stores start with Cashier, Stock, Floor and Supervisor positions.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(form) => start(async () => {
            setErrors({});
            const res = await saveLocationAction(store?.id ?? null, { ...formToRecord(form), timezone: tz });
            if (res.ok) { toast.success(store ? "Store saved." : "Store added."); setOpen(false); }
            else { setErrors(res.fieldErrors ?? {}); toast.error(res.error); }
          })}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="sname">Name</Label>
            <Input id="sname" name="name" defaultValue={store?.name} required />
            <FieldError msg={errors.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stz">Time zone</Label>
            <Select value={tz} onValueChange={setTz} disabled={store?.hasShifts}>
              <SelectTrigger id="stz" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{zones.map((z) => <SelectItem key={z} value={z}>{z.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
            {store?.hasShifts && <p className="text-xs text-muted-foreground">Locked because this store already has shifts.</p>}
            <FieldError msg={errors.timezone} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="saddr">Address (optional)</Label>
            <Input id="saddr" name="address" defaultValue={store?.address} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sbudget">Weekly labor budget (USD, optional)</Label>
            <Input id="sbudget" name="weeklyBudget" type="number" step="50" min="0"
              defaultValue={store?.weeklyBudgetCents != null ? store.weeklyBudgetCents / 100 : ""} />
            <FieldError msg={errors.weeklyBudget} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{store ? "Save store" : "Add store"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StoresEditor({ stores }: { stores: Store[] }) {
  return (
    <div className="grid max-w-3xl gap-3">
      <ul className="divide-y rounded-md border">
        {stores.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
            <div className="min-w-40 flex-1">
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.address || "No address"}</p>
            </div>
            <p className="text-sm text-muted-foreground">{s.timezone.replace("_", " ")}</p>
            <p className="w-32 text-right text-sm tabular-nums">
              {s.weeklyBudgetCents != null ? `${formatCents(s.weeklyBudgetCents, { compact: true })} / week` : <span className="text-muted-foreground">No budget</span>}
            </p>
            <StoreDialog store={s} trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`}><Pencil /></Button>} />
          </li>
        ))}
      </ul>
      <StoreDialog trigger={<Button variant="outline" className="w-fit"><Plus /> Add store</Button>} />
    </div>
  );
}

