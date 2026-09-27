"use client";

import { Loader2, Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Check your inbox.</p>
        <p className="mt-1 text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> belongs to a ShiftMate account, a sign-in link
          is on its way. It expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await authClient.signIn.magicLink({ email, callbackURL: "/", errorCallbackURL: "/login?error=link" });
          // Unknown addresses are reported as sent too, so the form can't be used to probe accounts.
          if (res.error && res.error.status === 429) setError("Too many attempts. Wait a minute and try again.");
          else setSent(true);
        });
      }}
    >
      <Label htmlFor="email">Work email</Label>
      <Input id="email" type="email" required autoComplete="email" placeholder="you@company.com"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Mail />} Email me a sign-in link
      </Button>
    </form>
  );
}
