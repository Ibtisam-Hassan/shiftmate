import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("ShiftMate <onboarding@resend.dev>"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DEMO_PASSWORD: z.string().min(12).optional(),
  CRON_SECRET: z.string().optional(),
});

// Parsed lazily so `next build` can type-check routes without a live env.
let cached: z.infer<typeof schema> | undefined;
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
