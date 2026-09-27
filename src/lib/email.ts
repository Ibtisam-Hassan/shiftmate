import { Resend } from "resend";
import { db } from "@/lib/db";

/**
 * Better Auth saves a link token for any address typed into the form; `disableSignUp` only
 * refuses it when used. We decide here whether to actually send the email.
 */
export async function canReceiveMagicLink(email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, select: { status: true } });
  return !!user && user.status !== "DEACTIVATED";
}

export async function sendMagicLinkEmail(to: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Local dev without Resend: the link is only printed to the server log.
    console.info(`[magic-link] ${to} -> ${url}`);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "ShiftMate <onboarding@resend.dev>",
    to,
    subject: "Your ShiftMate sign-in link",
    text: `Sign in to ShiftMate:\n\n${url}\n\nThis link expires in 15 minutes. If you didn't ask for it, ignore this email.`,
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}
