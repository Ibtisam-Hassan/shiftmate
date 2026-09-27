import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "@/server/authz/policy";

/** An expected failure whose message is safe to show the user. */
export class UserError extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Runs a server-action body and turns expected failures into a result instead of a 500. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toFailure(e);
  }
}

export function toFailure(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof UserError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { ok: false, error: "That already exists." };
  }
  if (isOverlapViolation(e)) {
    return { ok: false, error: "That person already has a shift at that time." };
  }
  // Next's redirect/notFound signals must propagate.
  if (e && typeof e === "object" && "digest" in e) throw e;
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export function isOverlapViolation(e: unknown): boolean {
  return String((e as Error)?.message ?? e).includes("shift_no_overlap");
}
