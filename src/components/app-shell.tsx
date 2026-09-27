"use client";

import {
  BarChart3, CalendarDays, Clock, Inbox, LogOut, Menu, Monitor, Moon, Settings, Sun, UserRoundCheck, Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Logo } from "@/components/logo";
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
  settings: Settings, clock: Clock,
} as const;

interface ShellUser { name: string; email: string; role: string; scope: string; isDemo: boolean }

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
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
        <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
          <Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.scope}</span>
          </span>
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
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
        <div className="px-2 py-3"><Logo /></div>
        <div className="mt-4 flex-1"><NavLinks items={nav} /></div>
        {user.isDemo && <Badge variant="secondary" className="mx-2 mb-2 w-fit">Demo · resets nightly</Badge>}
        <UserMenu user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Logo />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-3">
              <SheetTitle className="px-2 py-3"><Logo /></SheetTitle>
              <div className="flex-1"><NavLinks items={nav} onNavigate={() => setOpen(false)} /></div>
              <UserMenu user={user} />
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
