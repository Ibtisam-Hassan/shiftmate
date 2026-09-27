"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/authz/actor";
import { run } from "@/server/errors";
import { cancelTimeOff, decideTimeOff, requestTimeOff } from "@/server/services/time-off";

async function act<T>(fn: (a: Awaited<ReturnType<typeof requireActor>>) => Promise<T>) {
  const actor = await requireActor();
  const res = await run(() => fn(actor));
  if (res.ok) {
    revalidatePath("/requests");
    revalidatePath("/schedule");
  }
  return res;
}

export const requestTimeOffAction = async (input: { from: string; to: string; reason: string }) => act((a) => requestTimeOff(a, input));
export const cancelTimeOffAction = async (id: string) => act((a) => cancelTimeOff(a, id));
export const decideTimeOffAction = async (id: string, d: { approve: boolean; note?: string; openShifts?: boolean }) =>
  act((a) => decideTimeOff(a, id, d));
