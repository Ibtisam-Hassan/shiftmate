export const DEMO_EMAIL_DOMAIN = "demo.shiftmate.app";

export const DEMO_LOGINS = [
  { role: "Admin", email: `admin@${DEMO_EMAIL_DOMAIN}`, blurb: "All three stores, settings, overtime approvals" },
  { role: "Manager", email: `manager@${DEMO_EMAIL_DOMAIN}`, blurb: "Downtown store only: schedule, staff, requests" },
  { role: "Employee", email: `employee@${DEMO_EMAIL_DOMAIN}`, blurb: "My shifts, availability, swaps, time off" },
] as const;
