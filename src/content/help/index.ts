import type { Role } from "@/server/authz/policy";
import { admin } from "./admin";
import { basics } from "./basics";
import { publishing } from "./publishing";
import { requests } from "./requests";
import { scheduling } from "./scheduling";
import { swaps } from "./swaps";
import type { Topic } from "./types";

export type { Block, Topic } from "./types";

const ALL: Topic[] = [...basics, ...requests, ...swaps, ...scheduling, ...publishing, ...admin];

export function topicsFor(role: Role): Topic[] {
  return ALL.filter((t) => t.roles.length === 0 || t.roles.includes(role));
}
