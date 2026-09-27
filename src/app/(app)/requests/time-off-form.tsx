"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestTimeOffAction } from "./actions";

export function TimeOffForm({ today }: { today: string }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="grid max-w-xl gap-3 rounded-md border p-4 sm:grid-cols-2"
      action={(form) => start(async () => {
        setErrors({});
        const res = await requestTimeOffAction({ from: String(form.get("from")), to: String(form.get("to")), reason: String(form.get("reason") ?? "") });
        if (res.ok) toast.success("Sent. Your manager gets a notice.");
        else { setErrors(res.fieldErrors ?? {}); toast.error(res.error); }
      })}
    >
      <h2 className="font-semibold sm:col-span-2">Ask for time off</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="to-from">First day off</Label>
        <Input id="to-from" name="from" type="date" min={today} required />
        {errors.from && <p className="text-xs text-danger">{errors.from}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="to-to">Last day off</Label>
        <Input id="to-to" name="to" type="date" min={today} required />
        {errors.to && <p className="text-xs text-danger">{errors.to}</p>}
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="to-reason">Reason (optional)</Label>
        <Input id="to-reason" name="reason" maxLength={200} placeholder="For example: family event" />
      </div>
      <Button type="submit" disabled={pending} className="w-fit">{pending && <Loader2 className="animate-spin" />}Send request</Button>
    </form>
  );
}
