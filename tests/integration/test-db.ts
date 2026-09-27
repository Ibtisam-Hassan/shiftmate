import "dotenv/config";

/** TEST_DATABASE_URL, or DATABASE_URL with `_test` appended to the database name. */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}
