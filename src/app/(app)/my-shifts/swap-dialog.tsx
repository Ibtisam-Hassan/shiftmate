"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestSwapAction, swapOptionsAction } from "./actions";

type Option = { id: string; name: string; shifts: { id: string; label: string }[] };
const COVER = "__cover__";

export function SwapButton({ shiftId, label }: { shiftId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [who, setWho] = useState<string>("");
  const [trade, setTrade] = useState(COVER);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const person = options?.find((o) => o.id === who);

  const openDialog = () => {
    setOpen(true);
    if (!options) start(async () => {
      const res = await swapOptionsAction(shiftId);
      if (res.ok) setOptions(res.data); else toast.error(res.error);
    });
  };
  const send = () => start(async () => {
    const res = await requestSwapAction({ shiftId, targetUserId: who, targetShiftId: trade === COVER ? null : trade, message });
    if (res.ok) { toast.success(`Sent to ${person?.name.split(" ")[0]}. You get a notice when they answer.`); setOpen(false); }
    else toast.error(res.error);
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={openDialog}>Offer a swap</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offer your shift</DialogTitle>
            <DialogDescription>{label}. If your coworker says yes and nothing clashes, the swap happens at once. If something clashes, a manager decides.</DialogDescription>
          </DialogHeader>
          {!options ? <Loader2 className="mx-auto animate-spin" aria-label="Loading coworkers" /> : (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="sw-who">Coworker</Label>
                <Select value={who} onValueChange={(v) => { setWho(v); setTrade(COVER); }}>
                  <SelectTrigger id="sw-who" className="w-full"><SelectValue placeholder="Pick a coworker" /></SelectTrigger>
                  <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {person && (
                <div className="grid gap-1.5">
                  <Label htmlFor="sw-trade">What they give you</Label>
                  <Select value={trade} onValueChange={setTrade}>
                    <SelectTrigger id="sw-trade" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={COVER}>Nothing. They cover my shift.</SelectItem>
                      {person.shifts.map((s) => <SelectItem key={s.id} value={s.id}>Their shift: {s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="sw-msg">Message (optional)</Label>
                <Input id="sw-msg" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} placeholder="For example: family event that evening" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!who || pending} onClick={send}>{pending && options && <Loader2 className="animate-spin" />}Send offer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
