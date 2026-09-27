"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveRulesAction } from "./actions";
import { FieldError, formToRecord } from "./form-bits";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

