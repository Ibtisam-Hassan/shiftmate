import { cn } from "@/lib/utils";

/** Stencilled like a shipping box; the only place the stencil face is used. */
export function Logo({ className }: { className?: string }) {
  return <span className={cn("font-stencil text-2xl leading-none tracking-wide", className)}>ShiftMate</span>;
}
