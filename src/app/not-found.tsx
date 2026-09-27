import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="grid max-w-sm gap-4 text-center">
        <Logo className="mx-auto" />
        <h1 className="font-numeric text-5xl leading-none">Page not found</h1>
        <p className="text-muted-foreground">This page does not exist or you do not have access to it.</p>
        <Button asChild className="mx-auto w-fit"><Link href="/">Go to your home page</Link></Button>
      </div>
    </main>
  );
}
