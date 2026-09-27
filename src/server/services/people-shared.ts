import "server-only";
import { db } from "@/lib/db";
import { DEMO_LOGINS } from "@/lib/demo";
import { UserError } from "@/server/errors";

/** The demo logins must keep working for every visitor, so their email and role are locked. */
export const PROTECTED_DEMO_EMAILS = new Set<string>(DEMO_LOGINS.map((d) => d.email));

export async function loadTarget(id: string) {
  const u = await db.user.findUnique({ where: { id }, include: { locations: true, managerOf: true } });
  if (!u) throw new UserError("That person no longer exists.");
  return u;
}
