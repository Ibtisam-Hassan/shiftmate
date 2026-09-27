"use client";

import {
  Activity, BarChart3, CalendarDays, CircleHelp, Clock, Inbox, LogOut, Menu, Monitor, Moon, Settings, Sun, UserRoundCheck, Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notifications/bell";
import type { NavItem } from "@/components/nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const ICONS = {
  calendar: CalendarDays, "user-clock": UserRoundCheck, users: Users, inbox: Inbox, chart: BarChart3,
  settings: Settings, clock: Clock, help: CircleHelp, activity: Activity,
} as const;

interface ShellUser { name: string; email: string; role: string; scope: string; isDemo: boolean; unread: number }

function NavLinks({ items, onNavigate, vertical }: { items: NavItem[]; onNavigate?: () => void; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex gap-1", vertical ? "flex-col" : "items-stretch")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 px-3 text-sm font-medium text-kraft-foreground/75 transition-colors hover:text-kraft-foreground",
              vertical ? "rounded-md py-2 hover:bg-accent" : "border-b-2 border-transparent py-3",
              active && (vertical ? "bg-accent text-kraft-foreground" : "border-kraft-foreground text-kraft-foreground"),
            )}
          >
            {vertical && <Icon className="size-4" aria-hidden />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-1.5 py-1 hover:bg-black/5" aria-label="Account menu">
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-medium leading-tight">{user.name}</span>
            <span className="block text-xs leading-tight text-kraft-foreground/70">{user.scope}</span>
          </span>
          <Avatar className="size-8"><AvatarFallback className="bg-kraft-foreground text-kraft text-xs font-semibold">{initials}</AvatarFallback></Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme("light")}><Sun /> Light</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}><Moon /> Dark</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}><Monitor /> System</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ user, nav, children }: { user: ShellUser; nav: NavItem[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded bg-card px-3 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 bg-kraft text-kraft-foreground">
        <div className="flex items-center gap-6 px-4 md:px-6">
          <Link href="/" className="py-3"><Logo /></Link>
          <div className="hidden flex-1 md:block"><NavLinks items={nav} /></div>
          <div className="ml-auto flex items-center gap-2">
            {user.isDemo && <Badge variant="outline" className="hidden border-kraft-foreground/30 text-kraft-foreground lg:inline-flex">Demo data resets nightly</Badge>}
            <NotificationBell unread={user.unread} />
            <UserMenu user={user} />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-3">
                <SheetTitle className="px-2 py-3"><Logo /></SheetTitle>
                <NavLinks items={nav} vertical onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 p-3 outline-none md:p-5">
        <div className="min-h-full rounded-[3px] bg-card p-4 shadow-[0_1px_0_var(--border)] md:p-6">{children}</div>
      </main>
    </div>
  );
}
