"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/authz/actor";
import { run } from "@/server/errors";
import { type UnavailableWindow, saveUnavailability } from "@/server/services/availability";

export async function saveAvailabilityAction(windows: UnavailableWindow[]) {
  const actor = await requireActor();
  const res = await run(() => saveUnavailability(actor, windows));
  if (res.ok) revalidatePath("/availability");
  return res;
}
