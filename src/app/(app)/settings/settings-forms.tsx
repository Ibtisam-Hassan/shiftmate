"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/domain/pay";
import { cn } from "@/lib/utils";
import { archivePositionAction, saveLocationAction, savePositionAction, saveRulesAction } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const POSITION_SWATCH: Record<string, { cls: string; label: string }> = {
  cashier: { cls: "bg-pos-cashier", label: "Blue" },
  stock: { cls: "bg-pos-stock", label: "Purple" },
  floor: { cls: "bg-pos-floor", label: "Green" },
  supervisor: { cls: "bg-pos-supervisor", label: "Dark" },
};

function formToRecord(form: FormData) {
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-danger">{msg}</p> : null;
}

export function RulesForm({ defaults }: {
  defaults: { overtimeThresholdHours: number; overtimeMultiplier: number; weekStartsOn: number; minRestHours: number };
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState(String(defaults.weekStartsOn));
  return (
    <form
      className="grid max-w-2xl gap-4 sm:grid-cols-2"
      action={(form) => start(async () => {
        setErrors({});
        const res = await saveRulesAction({ ...formToRecord(form), weekStartsOn: weekStart });
        if (res.ok) toast.success("Rules saved. They apply to every store.");
        else { setErrors(res.fieldErrors ?? {}); toast.error(res.error); }
      })}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="ot">Overtime after (hours per week)</Label>
        <Input id="ot" name="overtimeThresholdHours" type="number" step="0.5" defaultValue={defaults.overtimeThresholdHours} />
        <FieldError msg={errors.overtimeThresholdHours} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mult">Overtime pay multiplier</Label>
        <Input id="mult" name="overtimeMultiplier" type="number" step="0.05" defaultValue={defaults.overtimeMultiplier} />
        <FieldError msg={errors.overtimeMultiplier} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="week">Week starts on</Label>
        <Select value={weekStart} onValueChange={setWeekStart}>
          <SelectTrigger id="week" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rest">Minimum rest between shifts (hours)</Label>
        <Input id="rest" name="minRestHours" type="number" step="0.5" defaultValue={defaults.minRestHours} />
        <FieldError msg={errors.minRestHours} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save rules</Button>
      </div>
    </form>
  );
}

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

interface Pos { id: string; name: string; color: string; archived: boolean }

function PositionRow({ storeId, pos }: { storeId: string; pos?: Pos }) {
  const [name, setName] = useState(pos?.name ?? "");
  const [color, setColor] = useState(pos?.color ?? "cashier");
  const [pending, start] = useTransition();
  const dirty = !pos || name !== pos.name || color !== pos.color;
  return (
    <form
      className={cn("flex items-center gap-2", pos?.archived && "opacity-60")}
      action={() => start(async () => {
        const res = await savePositionAction(storeId, pos?.id ?? null, { name, color });
        if (res.ok) { toast.success(pos ? "Position saved." : "Position added."); if (!pos) setName(""); }
        else toast.error(res.error);
      })}
    >
      <Select value={color} onValueChange={setColor}>
        <SelectTrigger className="w-28" aria-label="Colour">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(POSITION_SWATCH).map(([k, { cls, label }]) => (
            <SelectItem key={k} value={k}><span className={cn("inline-block h-2 w-5 rounded-sm", cls)} aria-hidden />{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New position" aria-label="Position name" className="max-w-56" />
      {dirty && name.trim() && <Button type="submit" size="sm" disabled={pending}>{pos ? "Save" : "Add"}</Button>}
      {pos && (
        <Button type="button" size="sm" variant="ghost" disabled={pending}
          onClick={() => start(async () => {
            const res = await archivePositionAction(storeId, pos.id, !pos.archived);
            if (!res.ok) toast.error(res.error);
          })}>
          {pos.archived ? "Restore" : "Archive"}
        </Button>
      )}
      {pos?.archived && <Badge variant="outline">Archived</Badge>}
    </form>
  );
}

export function PositionsEditor({ stores }: { stores: { id: string; name: string; positions: Pos[] }[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id);
  const store = stores.find((s) => s.id === storeId);
  return (
    <div className="grid max-w-3xl gap-3">
      <Select value={storeId} onValueChange={setStoreId}>
        <SelectTrigger className="w-48" aria-label="Store"><SelectValue /></SelectTrigger>
        <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      {store && (
        <div className="grid gap-2" key={store.id}>
          {store.positions.map((p) => <PositionRow key={p.id} storeId={store.id} pos={p} />)}
          <PositionRow storeId={store.id} />
        </div>
      )}
    </div>
  );
}
