import type { Topic } from "./types";

const MANAGERS: Topic["roles"] = ["ADMIN", "MANAGER"];

export const scheduling: Topic[] = [
  {
    id: "home",
    title: "The Home page",
    roles: MANAGERS,
    blocks: [
      { p: "Home is the first page that you see. It shows what needs you today." },
      { list: [
        "The sentence at the top names the problems, with a link to each one.",
        "Today shows who works now, as bars on the day. The blue line is the time now. Red stripes show hours with too few people.",
        "Waiting on you lists the decisions that only you can make, with a button for each one.",
        "Next week shows the draft, what blocks publishing, and a coverage strip for each day.",
        "The right column shows the cost against the budget, the people close to overtime, and recent changes.",
      ] },
      { p: "An admin can choose the store with the store buttons next to the date." },
    ],
  },
  {
    id: "build-week",
    title: "Build a week",
    roles: MANAGERS,
    blocks: [
      { p: "Each week starts as a draft. Staff cannot see a draft." },
      { steps: [
        "Open Schedule and go to the week with the arrow buttons.",
        "If the week is empty, click Copy last week, or add shifts one at a time.",
        "To add a shift, click Add shift, or double-click an empty box in the grid.",
        "Fill in the day, the times, the person and the position, then click Add shift.",
      ] },
      { p: "If the end time is earlier than the start time, the shift ends on the next day." },
      { p: "Copy last week keeps the same times. If a person now has time off or another shift at that time, their copy becomes an open shift." },
    ],
  },
  {
    id: "move-shift",
    title: "Move a shift",
    roles: MANAGERS,
    blocks: [
      { p: "Drag a shift to another person or another day. The times stay the same." },
      { p: "While you drag, the grid marks each box:" },
      { list: [
        "Blue boxes are free.",
        "Striped gray boxes are busy. You cannot drop the shift there.",
        "Boxes with a warning sign are allowed, but the person is unavailable or on time off.",
      ] },
      { p: "The small card next to your pointer shows the new weekly hours of the person under the pointer." },
      { p: "To move a shift with the keyboard, press Tab until the shift is selected. Press Space, use the arrow keys, and press Space again." },
    ],
  },
  {
    id: "shift-details",
    title: "Change or remove a shift",
    roles: MANAGERS,
    blocks: [
      { p: "Click a shift to open its details. The details show the paid hours, the cost and any problems." },
      { list: [
        "Edit changes the times, the person, the position, the break or the notes.",
        "Reassign shows the best people for the shift.",
        "Make open removes the person and keeps the shift.",
        "Delete removes the shift.",
      ] },
    ],
  },
  {
    id: "assign",
    title: "Fill an open shift",
    roles: MANAGERS,
    blocks: [
      { p: "Click an open shift, then click Assign. ShiftMate shows the best people first, in this order:" },
      { steps: [
        "People who get no extra overtime.",
        "People who get enough rest between shifts.",
        "People who do not work that day yet.",
        "People who cost less.",
      ] },
      { p: "People who are busy, unavailable or on time off are not in the list. Their names and reasons show under Not suggested." },
    ],
  },
];
