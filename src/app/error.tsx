"use client";

import { Button } from "@/components/ui/button";

/** Shown when a page fails to load. The digest helps find the error in the server logs. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6">
      <div className="grid max-w-sm gap-4 text-center">
        <h1 className="font-numeric text-4xl leading-none">Something went wrong</h1>
        <p className="text-muted-foreground">The page did not load. Try again. If it keeps failing, tell your admin the code below.</p>
        {error.digest && <code className="mx-auto rounded bg-muted px-2 py-1 text-xs">{error.digest}</code>}
        <Button className="mx-auto w-fit" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
