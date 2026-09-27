export const TZ = "America/Chicago";
export const WEEK_STARTS_ON = 1;

export const STORES = [
  { key: "downtown", name: "Downtown", address: "120 N State St, Chicago, IL", budget: 740000 },
  { key: "riverside", name: "Riverside", address: "44 E Burlington St, Riverside, IL", budget: 620000 },
  { key: "oakpark", name: "Oak Park", address: "1010 Lake St, Oak Park, IL", budget: 600000 },
] as const;

export const POSITIONS = [
  { name: "Cashier", color: "cashier" },
  { name: "Stock", color: "stock" },
  { name: "Floor", color: "floor" },
  { name: "Supervisor", color: "supervisor" },
] as const;

export const FIRST = ["Maya", "Omar", "Priya", "Diego", "Hana", "Liam", "Zara", "Noah", "Aisha", "Ethan", "Sofia", "Kai",
  "Lena", "Mateo", "Chloe", "Ravi", "Nora", "Felix", "Yuki", "Samir", "Grace", "Leo", "Amara", "Theo", "Ines", "Owen"];
export const LAST = ["Patel", "Nguyen", "Garcia", "Kim", "Okafor", "Rossi", "Chen", "Haddad", "Silva", "Novak", "Park",
  "Mensah", "Ito", "Larsen", "Costa", "Ahmed", "Dubois", "Reyes", "Walsh", "Singh", "Moreau", "Tanaka", "Adeyemi", "Berg", "Khan", "Lopez"];
export const MANAGER_NAMES = ["Jordan Blake", "Sam Whitfield", "Riley Osei"];

/** Open 08:00 to 22:00. [startMinute, endMinute, position, breakMinutes] */
export type Slot = [number, number, string, number];
export const DAY_SLOTS: Slot[] = [
  [480, 960, "Cashier", 30],
  [480, 960, "Stock", 30],
  [600, 1080, "Supervisor", 30],
  [660, 1140, "Floor", 30],
  [840, 1320, "Cashier", 30],
  [840, 1320, "Floor", 30],
];
export const WEEKEND_EXTRA: Slot[] = [[720, 1320, "Cashier", 30]];

/** Small deterministic random numbers, so every reset builds the same demo. */
export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}
