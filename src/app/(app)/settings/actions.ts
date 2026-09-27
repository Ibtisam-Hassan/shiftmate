"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/authz/actor";
import { run } from "@/server/errors";
import { archivePosition, saveLocation, savePosition, updateOrgRules } from "@/server/services/settings";

async function act<T>(fn: (actor: Awaited<ReturnType<typeof requireActor>>) => Promise<T>) {
  const actor = await requireActor();
  const res = await run(() => fn(actor));
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function saveRulesAction(input: Record<string, string>) {
  return act((a) => updateOrgRules(a, input as never));
}
export async function saveLocationAction(id: string | null, input: Record<string, string>) {
  return act((a) => saveLocation(a, id, input as never));
}
export async function savePositionAction(locationId: string, id: string | null, input: { name: string; color: string }) {
  return act((a) => savePosition(a, locationId, id, input as never));
}
export async function archivePositionAction(locationId: string, id: string, archived: boolean) {
  return act((a) => archivePosition(a, locationId, id, archived));
}
