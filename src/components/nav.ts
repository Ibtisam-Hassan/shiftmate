import type { Role } from "@/server/authz/policy";

export interface NavItem {
  href: string;
  label: string;
  icon: "calendar" | "user-clock" | "users" | "inbox" | "chart" | "settings" | "clock" | "help";
}

export function navFor(role: Role): NavItem[] {
  if (role === "EMPLOYEE") {
    return [
      { href: "/my-shifts", label: "My shifts", icon: "user-clock" },
      { href: "/schedule", label: "Store schedule", icon: "calendar" },
      { href: "/availability", label: "Availability", icon: "clock" },
      { href: "/requests", label: "Requests", icon: "inbox" },
      { href: "/help", label: "Help", icon: "help" },
    ];
  }
  const items: NavItem[] = [
    { href: "/schedule", label: "Schedule", icon: "calendar" },
    { href: "/team", label: "Team", icon: "users" },
    { href: "/requests", label: "Requests", icon: "inbox" },
    { href: "/labor", label: "Labor cost", icon: "chart" },
  ];
  if (role === "ADMIN") items.push({ href: "/settings", label: "Settings", icon: "settings" });
  items.push({ href: "/help", label: "Help", icon: "help" });
  return items;
}
