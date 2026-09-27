import { Skeleton } from "@/components/ui/skeleton";

/** A grid-shaped placeholder while the week loads. */
export default function Loading() {
  return (
    <div className="grid gap-3" aria-busy aria-label="Loading the schedule">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-9 w-full" />
      <div className="grid grid-cols-[176px_repeat(7,minmax(0,1fr))] gap-px">
        {Array.from({ length: 64 }, (_, i) => <Skeleton key={i} className="h-12 rounded-none motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}
