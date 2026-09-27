import type { Topic } from "./types";

export const requests: Topic[] = [
  {
    id: "availability",
    title: "Set when you cannot work",
    roles: ["EMPLOYEE"],
    blocks: [
      { p: "Your availability tells your manager the times that you cannot work each week." },
      { steps: [
        "Open Availability.",
        "Next to a day, click Block all day or Block some hours.",
        "If you chose some hours, type the start and the end, then click Add.",
        "Click Save availability.",
      ] },
      { p: "The change applies from today. Your manager can still put you on a shift at that time, but ShiftMate shows them a warning." },
      { p: "For one special day, ask for time off instead." },
    ],
  },
  {
    id: "ask-time-off",
    title: "Ask for time off",
    roles: ["EMPLOYEE"],
    blocks: [
      { steps: [
        "Open Requests.",
        "Choose the first day off and the last day off.",
        "Add a reason if you want to, then click Send request.",
      ] },
      { p: "Your managers get a notice. You get a notice when they approve or deny the request." },
      { p: "If your plans change, click Cancel request. You can cancel until the time off starts." },
    ],
  },
  {
    id: "review-time-off",
    title: "Approve or deny time off",
    roles: ["ADMIN", "MANAGER"],
    blocks: [
      { p: "Open Requests to see the requests that wait for you. A manager sees requests from the staff of their store." },
      { p: "If the person already has shifts in that period, ShiftMate shows how many. Leave the box “Also make their shifts in this period open” selected. Their shifts become open shifts when you approve." },
      { p: "Add a note if you want to, then click Approve or Deny. The person gets a notice with your note." },
      { p: "Approved time off shows as Time off on the schedule. If someone is on a shift during approved time off, the shift gets a warning." },
    ],
  },
];
