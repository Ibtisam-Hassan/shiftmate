import type { Role } from "@/server/authz/policy";
import { admin } from "./admin";
import { basics } from "./basics";
import { publishing } from "./publishing";
import { scheduling } from "./scheduling";
import type { Topic } from "./types";

export type { Block, Topic } from "./types";

const ALL: Topic[] = [...basics, ...scheduling, ...publishing, ...admin];

export function topicsFor(role: Role): Topic[] {
  return ALL.filter((t) => t.roles.length === 0 || t.roles.includes(role));
}
