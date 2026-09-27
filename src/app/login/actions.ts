"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DEMO_LOGINS } from "@/lib/demo";

export async function demoSignIn(email: string) {
  if (process.env.DEMO_MODE !== "true" || !process.env.DEMO_PASSWORD) {
    throw new Error("Demo mode is off.");
  }
  if (!DEMO_LOGINS.some((d) => d.email === email)) throw new Error("Unknown demo account.");
  await auth.api.signInEmail({
    body: { email, password: process.env.DEMO_PASSWORD },
    headers: await headers(),
  });
  redirect("/");
}
