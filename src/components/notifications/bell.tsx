"use client";

import { Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { openInboxAction } from "./actions";

type Item = Awaited<ReturnType<typeof openInboxAction>>[number];

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

export function NotificationBell({ unread }: { unread: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [count, setCount] = useState(unread);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) start(async () => { setItems(await openInboxAction()); setCount(0); });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-black/5" aria-label={count ? `Notifications, ${count} new` : "Notifications"}>
          <Bell />
          {count > 0 && <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-2 font-semibold">Notifications</p>
        {pending && !items && <Loader2 className="mx-auto my-6 animate-spin" aria-label="Loading" />}
        {items && items.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing new. Changes to your shifts show up here.</p>}
        {items && items.length > 0 && (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? "#"} onClick={() => setOpen(false)} className={cn("block px-4 py-3 hover:bg-accent", n.unread && "bg-accent/40")}>
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="block text-[11px] text-muted-foreground">{ago(n.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
