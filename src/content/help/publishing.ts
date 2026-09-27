import type { Topic } from "./types";

const MANAGERS: Topic["roles"] = ["ADMIN", "MANAGER"];

export const publishing: Topic[] = [
  {
    id: "problems",
    title: "Problems and warnings",
    roles: MANAGERS,
    blocks: [
      { p: "The Ready to publish panel lists everything that needs a decision. Click an item to find its shift in the grid." },
      { list: [
        "Blocks publishing: you must fix these before you can publish.",
        "Check before publishing: you can publish, but look at these first.",
        "Open shifts: shifts that have no person yet.",
        "Kept anyway: warnings that you decided to accept.",
      ] },
      { p: "A warning shows a triangle and a striped bar. ShiftMate gives a warning when:" },
      { list: [
        "The person is unavailable at that time.",
        "The person has approved time off.",
        "The person gets less rest than the rest time in Settings, 8 hours by default.",
        "The person does not usually work at this store.",
        "Fewer people than the minimum are at work in an hour when the store is open.",
      ] },
      { p: "If you want to keep a warning, open the shift, click Keep anyway and write a short reason. ShiftMate saves the reason with the shift." },
      { p: "ShiftMate does not let you put one person on two shifts at the same time, at any store." },
    ],
  },
  {
    id: "overtime",
    title: "Overtime",
    roles: MANAGERS,
    blocks: [
      { p: "Overtime is the hours past the weekly limit. The limit is 40 hours unless an admin changes it in Settings." },
      { p: "ShiftMate adds up the hours of a person at all stores. A person with 30 hours at one store and 12 at another has 2 hours of overtime." },
      { p: "A manager or admin must approve overtime before the week can be published. Click Approve in the Ready to publish panel." },
      { p: "The approval is for the hours that are scheduled now. If you add more hours later, you must approve again." },
    ],
  },
  {
    id: "publish",
    title: "Publish a week",
    roles: MANAGERS,
    blocks: [
      { p: "When nothing blocks publishing, the Publish week button becomes active." },
      { steps: [
        "Look at the Ready to publish panel.",
        "Fix or approve each item under Blocks publishing.",
        "Click Publish week.",
      ] },
      { p: "Each person with a shift that week gets a notice in the app. After you publish, you can still change shifts. The people who are affected get a notice for each change." },
    ],
  },
  {
    id: "labor",
    title: "Labor cost and budget",
    roles: MANAGERS,
    blocks: [
      { p: "The strip above the grid shows the hours and the cost of the week at this store." },
      { list: [
        "Paid hours are the shift length minus the unpaid break.",
        "Regular pay is paid hours up to the overtime limit, times the hourly rate.",
        "Overtime pay is the hours past the limit, times the rate, times the overtime multiplier.",
        "Each shift uses the hourly rate that applied on the day of the shift.",
      ] },
      { p: "If the store has a weekly budget, the bar shows how much of the budget the week uses. Overtime shows as a striped part of the bar." },
      { note: "If a person has no hourly rate, the cost of their shifts is not counted. Add a rate on the Team page." },
    ],
  },
  {
    id: "labor-page",
    title: "The Labor cost page",
    roles: MANAGERS,
    blocks: [
      { p: "The Labor cost page shows the scheduled cost of each week. A manager sees their store. An admin sees every store, one chart for each." },
      { p: "Each bar is one week. The solid part is regular pay. The striped part on top is overtime pay. The dashed line is the weekly budget." },
      { p: "Point at a bar, or press Tab to reach it, to see the numbers for that week. Click Show the numbers to see all weeks in a table." },
      { p: "The table of people shows who worked in the chosen week. Hours count every store. Cost counts this store only." },
      { p: "Click Download CSV to get one row for each shift in the chosen week. You can open the file in Excel or Google Sheets." },
    ],
  },
  {
    id: "coverage",
    title: "Coverage",
    roles: MANAGERS,
    blocks: [
      { p: "The small bars under each day show how many people are at work in each hour, from 6 AM to 11 PM." },
      { p: "If fewer people than the minimum work during opening hours, the hour turns red. The Ready to publish panel lists it, and Add a shift fills the gap." },
    ],
  },
];
