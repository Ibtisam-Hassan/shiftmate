import { db } from "@/lib/db";
import { resetDemoData } from "@/server/demo/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (process.env.DEMO_MODE !== "true") return new Response("Demo mode off", { status: 409 });
  const result = await resetDemoData(db, { adminEmail: process.env.OWNER_EMAIL });
  return Response.json({ ok: true, ...result });
}
