"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/authz/actor";
import { run } from "@/server/errors";
import {
  type PersonInput, addPayRate, createPerson, setPersonStatus, updatePerson,
} from "@/server/services/people";

export async function savePersonAction(id: string | null, input: PersonInput) {
  const actor = await requireActor();
  const res = await run(async () => (id ? (await updatePerson(actor, id, input), { id }) : createPerson(actor, input)));
  if (res.ok) revalidatePath("/team");
  return res;
}

export async function setStatusAction(id: string, status: "ACTIVE" | "DEACTIVATED") {
  const actor = await requireActor();
  const res = await run(() => setPersonStatus(actor, id, status));
  if (res.ok) revalidatePath("/team");
  return res;
}

export async function addPayRateAction(id: string, input: { hourlyRate: string; effectiveFrom: string }) {
  const actor = await requireActor();
  const res = await run(() => addPayRate(actor, id, input));
  if (res.ok) revalidatePath("/team");
  return res;
}
