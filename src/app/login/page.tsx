import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { getActor } from "@/server/authz/actor";
import { DemoButtons } from "./demo-buttons";
import { MagicLinkForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getActor()) redirect("/");
  const { error } = await searchParams;
  const demo = process.env.DEMO_MODE === "true";

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-kraft p-10 text-kraft-foreground lg:flex">
        <Logo className="text-3xl" />
        <div className="max-w-md space-y-4">
          <h1 className="font-numeric text-6xl leading-[0.95]">Schedules your stores can actually run on.</h1>
          <p className="max-w-sm text-kraft-foreground/80">
            Build the week by drag and drop, catch double-bookings and overtime before you publish, and let staff
            swap shifts without a group chat.
          </p>
        </div>
        <p className="text-sm text-kraft-foreground/70">Portfolio project. Demo data resets every night.</p>
      </section>

      <section className="flex items-center justify-center bg-card p-6">
        <div className="w-full max-w-sm space-y-6">
          <Logo className="lg:hidden" />
          <div className="space-y-1">
            <h2 className="font-numeric text-4xl leading-none">{demo ? "Try ShiftMate" : "Sign in"}</h2>
            <p className="text-sm text-muted-foreground">
              {demo ? "Pick a role to explore a demo store. Nothing you do affects anyone." : "ShiftMate is invite-only. Use the email your manager added."}
            </p>
          </div>
          {error === "link" && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              That sign-in link is invalid or has expired. Request a new one.
            </p>
          )}
          {demo && <DemoButtons />}
          {demo && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" /> Have an invite? <Separator className="flex-1" />
            </div>
          )}
          <MagicLinkForm />
        </div>
      </section>
    </main>
  );
}
