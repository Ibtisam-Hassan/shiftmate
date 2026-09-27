import { testDatabaseUrl } from "./test-db";

// Must run before anything imports "@/lib/db".
process.env.DATABASE_URL = testDatabaseUrl();
process.env.DEMO_PASSWORD ??= "integration-demo-password";
