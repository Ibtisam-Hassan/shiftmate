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
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo className="text-lg [&>span]:bg-primary-foreground [&>span]:text-primary" />
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Schedules your stores can actually run on.</h1>
          <p className="text-primary-foreground/80">
            Build the week by drag and drop, catch double-bookings and overtime before you publish, and let staff
            swap shifts without a group chat.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">Portfolio project · data resets nightly</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <Logo className="lg:hidden" />
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">ShiftMate is invite-only. Use the email your manager added.</p>
          </div>
          {error === "link" && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              That sign-in link is invalid or has expired. Request a new one.
            </p>
          )}
          <MagicLinkForm />
          {demo && (
            <>
              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <Separator className="flex-1" /> or explore the demo <Separator className="flex-1" />
              </div>
              <DemoButtons />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
