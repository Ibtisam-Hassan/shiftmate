"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/domain/pay";
import type { TeamMember } from "@/server/services/people";
import { addPayRateAction } from "./actions";

export function PayRateDialog({ person, open, onOpenChange }: {
  person: TeamMember; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay rate for {person.name}</DialogTitle>
          <DialogDescription>A new rate applies to shifts on or after its start date. Past weeks keep the rate they had.</DialogDescription>
        </DialogHeader>
        {person.rates.length > 0 && (
          <ol className="divide-y rounded-md border text-sm">
            {person.rates.map((r) => (
              <li key={r.effectiveFrom} className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">From {r.effectiveFrom}</span>
                <span className="font-medium tabular-nums">{formatCents(r.hourlyRateCents)}/h</span>
              </li>
            ))}
          </ol>
        )}
        <form
          className="grid gap-4"
          action={(form) => {
            setErrors({});
            start(async () => {
              const res = await addPayRateAction(person.id, {
                hourlyRate: String(form.get("hourlyRate")), effectiveFrom: String(form.get("effectiveFrom")),
              });
              if (res.ok) { toast.success("Pay rate saved."); onOpenChange(false); }
              else { setErrors(res.fieldErrors ?? {}); toast.error(res.error); }
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="hourlyRate">New rate (USD/h)</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" step="0.25" min="7.25" required />
              {errors.hourlyRate && <p className="text-xs text-danger">{errors.hourlyRate}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="effectiveFrom">Starts on</Label>
              <Input id="effectiveFrom" name="effectiveFrom" type="date" defaultValue={today} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save rate</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
