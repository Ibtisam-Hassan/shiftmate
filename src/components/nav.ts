import type { Role } from "@/server/authz/policy";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
  icon: "calendar" | "user-clock" | "users" | "inbox" | "chart" | "settings" | "clock" | "help" | "activity" | "home";
}

/** Main tabs. Settings and Help live in the account menu to keep the bar short. */
export function navFor(role: Role, counts: Record<string, number> = {}): NavItem[] {
  const items: NavItem[] = role === "EMPLOYEE"
    ? [
        { href: "/my-shifts", label: "My shifts", icon: "user-clock" },
        { href: "/schedule", label: "Store schedule", icon: "calendar" },
        { href: "/availability", label: "Availability", icon: "clock" },
        { href: "/requests", label: "Requests", icon: "inbox" },
      ]
    : [
        { href: "/home", label: "Home", icon: "home" },
        { href: "/schedule", label: "Schedule", icon: "calendar" },
        { href: "/requests", label: "Requests", icon: "inbox" },
        { href: "/team", label: "Team", icon: "users" },
        { href: "/labor", label: "Labor cost", icon: "chart" },
        { href: "/activity", label: "Activity", icon: "activity" },
      ];
  return items.map((i) => ({ ...i, badge: counts[i.href] || undefined }));
}
