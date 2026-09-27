import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";

import { DEMO_EMAIL_DOMAIN } from "@/lib/demo";

const demoMode = process.env.DEMO_MODE === "true";

export const auth = betterAuth({
  appName: "ShiftMate",
  baseURL: process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Password sign-in exists only so the demo buttons work: sign-up is off and real users
  // never get a credential account, so the hook below is the whole gate.
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "EMPLOYEE" },
      status: { type: "string", input: false, defaultValue: "INVITED" },
      isDemo: { type: "boolean", input: false, defaultValue: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String(ctx.body?.email ?? "").toLowerCase();
      if (!demoMode || !email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
        throw new APIError("FORBIDDEN", { message: "Password sign-in is disabled." });
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (!user || user.status === "DEACTIVATED") return false;
          if (user.status === "INVITED") {
            await db.user.update({ where: { id: session.userId }, data: { status: "ACTIVE" } });
          }
        },
      },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true, // invite-only: unknown emails get no link
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url),
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
