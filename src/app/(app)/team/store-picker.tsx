"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  locations: { id: string; name: string }[];
  storeIds: string[];
  setStoreIds: (f: (ids: string[]) => string[]) => void;
  homeId?: string;
  setHomeId: (id: string) => void;
  error?: string;
}

/** Which stores an employee can work at, and which one is home. */
export function StorePicker({ locations, storeIds, setStoreIds, homeId, setHomeId, error }: Props) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Stores they can work at</legend>
      {locations.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={storeIds.includes(l.id)}
              onCheckedChange={(c) => setStoreIds((ids) => (c ? [...ids, l.id] : ids.filter((x) => x !== l.id)))}
            />
            {l.name}
          </label>
          {storeIds.includes(l.id) && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="radio" name="home" checked={homeId === l.id} onChange={() => setHomeId(l.id)} className="accent-primary" />
              Home store
            </label>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
