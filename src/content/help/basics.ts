import type { Topic } from "./types";

export const basics: Topic[] = [
  {
    id: "sign-in",
    title: "Sign in",
    roles: [],
    blocks: [
      { p: "ShiftMate does not use passwords. You sign in with a link that we send to your email." },
      { steps: [
        "Type your work email on the sign-in page.",
        "Click Email me a sign-in link.",
        "Open the email and click the link within 15 minutes.",
      ] },
      { p: "If no email arrives, ask your manager to make sure that your email address in ShiftMate is correct." },
      { note: "Do not forward the sign-in link. Anyone with the link can sign in as you until it expires." },
    ],
  },
  {
    id: "words",
    title: "Words used in ShiftMate",
    roles: [],
    blocks: [
      { list: [
        "Shift: one block of work time for one person at one store.",
        "Open shift: a shift that has no person yet.",
        "Draft: a week that staff cannot see yet.",
        "Published: a week that staff can see.",
        "Overtime: hours past the weekly limit, usually 40 hours.",
        "Coverage: the number of people at work in each hour.",
        "Break: unpaid time inside a shift.",
      ] },
    ],
  },
  {
    id: "notifications",
    title: "Notices about your schedule",
    roles: [],
    blocks: [
      { p: "ShiftMate tells you about changes inside the app. It does not send texts." },
      { p: "You get a notice when your manager publishes a week that includes you. You also get a notice when someone changes one of your shifts in a published week." },
      { p: "If you are an employee on a phone, use the tabs at the bottom of the screen to open your main pages. Help is in the menu under your initials." },
    ],
  },
  {
    id: "my-schedule",
    title: "See the store schedule",
    roles: ["EMPLOYEE"],
    blocks: [
      { p: "Open Store schedule to see who works each day. You can only see weeks that your manager published." },
      { p: "If you work at more than one store, use the store buttons at the top to change the store." },
      { p: "If a week shows This week is not published yet, your manager is still making it. You get a notice when it is ready." },
    ],
  },
];
