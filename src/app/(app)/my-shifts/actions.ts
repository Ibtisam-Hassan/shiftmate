"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/authz/actor";
import { run } from "@/server/errors";
import { swapOptions } from "@/server/services/my-shifts";
import { cancelSwap, decideSwap, requestSwap, respondSwap } from "@/server/services/swaps";

async function act<T>(fn: (a: Awaited<ReturnType<typeof requireActor>>) => Promise<T>) {
  const actor = await requireActor();
  const res = await run(() => fn(actor));
  if (res.ok) {
    revalidatePath("/my-shifts");
    revalidatePath("/requests");
    revalidatePath("/schedule");
  }
  return res;
}

export const swapOptionsAction = async (shiftId: string) => act((a) => swapOptions(a, shiftId));
export const requestSwapAction = async (input: { shiftId: string; targetUserId: string; targetShiftId: string | null; message: string }) =>
  act((a) => requestSwap(a, input));
export const respondSwapAction = async (id: string, accept: boolean) => act((a) => respondSwap(a, id, accept));
export const cancelSwapAction = async (id: string) => act((a) => cancelSwap(a, id));
export const decideSwapAction = async (id: string, approve: boolean) => act((a) => decideSwap(a, id, approve));
