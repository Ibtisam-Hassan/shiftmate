"use client";

import { CalendarDays, Clock, Inbox, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/nav";
import { cn } from "@/lib/utils";

const ICONS = { "user-clock": UserRoundCheck, calendar: CalendarDays, clock: Clock, inbox: Inbox } as const;

/** Employees live on phones: their main pages sit one tap away at the bottom of the screen. */
export function BottomTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-kraft pb-[env(safe-area-inset-bottom)] text-kraft-foreground sm:hidden">
      {items.map((item) => {
        const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Inbox;
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn("relative grid min-h-14 place-items-center gap-0.5 py-1.5 text-[11px] font-medium", active ? "bg-card text-foreground" : "opacity-80")}>
            <Icon className="size-5" aria-hidden />
            {item.label.replace("Store schedule", "Schedule")}
            {item.badge ? <span className="absolute top-1 right-[calc(50%-1.25rem)] grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
