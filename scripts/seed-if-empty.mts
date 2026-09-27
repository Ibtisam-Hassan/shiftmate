import "dotenv/config";
import { db } from "@/lib/db";
import { resetDemoData } from "@/server/demo/seed";

// First deploy only: fill an empty demo database. Later deploys leave data alone; the nightly
// cron keeps it fresh.
if (process.env.DEMO_MODE !== "true") {
  console.log("Demo mode is off: not seeding.");
} else if (await db.organization.count()) {
  console.log("Database already has data: not seeding.");
} else {
  const r = await resetDemoData(db, { adminEmail: process.env.OWNER_EMAIL });
  console.log(`Seeded empty database: ${r.users} users, ${r.shifts} shifts.`);
}
await db.$disconnect();
