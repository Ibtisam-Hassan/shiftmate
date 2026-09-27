import "dotenv/config";
import { db } from "@/lib/db";
import { resetDemoData } from "@/server/demo/seed";

const result = await resetDemoData(db, { adminEmail: process.env.OWNER_EMAIL });
console.log(`Seeded demo: ${result.users} users, ${result.shifts} shifts, current week ${result.weekStart}`);
await db.$disconnect();
