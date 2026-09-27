"use client";

import { Loader2, ShieldCheck, Store, User } from "lucide-react";
import { useTransition, useState } from "react";
import { toast } from "sonner";
import { DEMO_LOGINS } from "@/lib/demo";
import { demoSignIn } from "./actions";

const ICONS = { Admin: ShieldCheck, Manager: Store, Employee: User } as const;

export function DemoButtons() {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      {DEMO_LOGINS.map((d) => {
        const Icon = ICONS[d.role];
        return (
          <button
            key={d.role}
            type="button"
            disabled={pending}
            onClick={() => {
              setWhich(d.role);
              start(async () => {
                try {
                  await demoSignIn(d.email);
                } catch (e) {
                  // redirect() inside the action surfaces here as a special error; let Next handle it.
                  if (e && typeof e === "object" && "digest" in e) throw e;
                  toast.error("Demo sign-in failed. Try again in a moment.");
                }
              });
            }}
            className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/60 hover:bg-primary/5 disabled:opacity-60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              {pending && which === d.role ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Try as {d.role}</span>
              <span className="block truncate text-xs text-muted-foreground">{d.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
