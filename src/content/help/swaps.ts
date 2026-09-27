import type { Topic } from "./types";

export const swaps: Topic[] = [
  {
    id: "offer-swap",
    title: "Give away or trade a shift",
    roles: ["EMPLOYEE"],
    blocks: [
      { steps: [
        "Open My shifts.",
        "Next to the shift, click Offer a swap.",
        "Pick a coworker from the same store.",
        "Choose what they give you: nothing, or one of their shifts.",
        "Click Send offer.",
      ] },
      { p: "Your coworker gets a notice. If they accept and nothing clashes, the swap happens at once." },
      { p: "If the swap gives someone overtime, too little rest, or a shift when they are unavailable, a manager must approve it first." },
      { p: "You can only offer shifts from a published week that did not start yet. Click Cancel offer if your plans change." },
    ],
  },
  {
    id: "answer-swap",
    title: "Answer a swap request",
    roles: ["EMPLOYEE"],
    blocks: [
      { p: "Swap requests for you show at the top of My shifts, with a striped edge. The card shows the shift that you take and, for a trade, the shift that you give." },
      { p: "Click Accept or Decline. The person who asked gets a notice." },
    ],
  },
  {
    id: "approve-swap",
    title: "Approve a shift swap",
    roles: ["ADMIN", "MANAGER"],
    blocks: [
      { p: "Most swaps do not need you. A swap comes to you only when it causes a problem, for example overtime." },
      { p: "Open Requests. Under Shift swaps, the swaps that wait for you come first, with the reason." },
      { p: "Click Approve swap or Do not approve. Both people get a notice. The list also shows every swap at your store from the last 30 days." },
    ],
  },
  {
    id: "bell",
    title: "The bell",
    roles: [],
    blocks: [
      { p: "The bell at the top shows how many notices are new. Click it to read them. Opening the bell marks them as read." },
    ],
  },
];
