import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-db";

export default function setup() {
  const url = testDatabaseUrl();
  execSync("npx prisma migrate reset --force", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes" },
  });
}
