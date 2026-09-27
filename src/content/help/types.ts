import type { Role } from "@/server/authz/policy";

/** One block of help text. Plain strings only, so writers never touch layout code. */
export type Block =
  | { p: string }
  | { steps: string[] }
  | { list: string[] }
  | { note: string };

export interface Topic {
  id: string;
  title: string;
  /** Who sees the topic. Empty means everyone. */
  roles: Role[];
  blocks: Block[];
}
