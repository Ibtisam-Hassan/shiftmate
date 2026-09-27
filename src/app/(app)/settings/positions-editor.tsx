"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { archivePositionAction, savePositionAction } from "./actions";
import { POSITION_SWATCH } from "./form-bits";

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
