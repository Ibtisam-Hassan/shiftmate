"use server";

import { requireActor } from "@/server/authz/actor";
import { markAllRead, recentNotifications } from "@/server/services/notifications";

/** Opening the bell lists recent notices and marks them read. */
export async function openInboxAction() {
  const actor = await requireActor();
  const items = await recentNotifications(actor);
  await markAllRead(actor);
  return items;
}
