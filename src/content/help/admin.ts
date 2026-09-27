import type { Topic } from "./types";

export const admin: Topic[] = [
  {
    id: "team",
    title: "Add and manage people",
    roles: ["ADMIN", "MANAGER"],
    blocks: [
      { steps: [
        "Open Team and click Add person.",
        "Type the name, the email and the hourly rate.",
        "Click Add person. The person can now sign in with that email.",
      ] },
      { p: "A manager can add people only to their own store. An admin can choose the stores and the role." },
      { p: "To change a pay rate, click the three dots next to the person and choose Change pay rate. The new rate starts on the date that you choose. Past weeks keep the old rate." },
      { note: "If you deactivate a person, they cannot sign in. Their future shifts become open shifts." },
    ],
  },
  {
    id: "settings",
    title: "Rules, stores and positions",
    roles: ["ADMIN"],
    blocks: [
      { p: "Only admins can open Settings. The rules apply to every store." },
      { list: [
        "Overtime after: the weekly hour limit, 40 by default.",
        "Overtime pay multiplier: 1.5 means overtime pays one and a half times the rate.",
        "Week starts on: the first day of each schedule week.",
        "Minimum rest: the fewest hours between two shifts before ShiftMate gives a warning.",
      ] },
      { p: "Each store has a name, a time zone, an address and a weekly budget. After a store has shifts, you cannot change its time zone. A change would move every shift to a different time." },
      { p: "Positions are the jobs that a shift is for, such as Cashier. Each position has a color in the grid." },
    ],
  },
];
