import { Skeleton } from "@/components/ui/skeleton";

export function ViewSkeleton() {
  return (
    <div className="view-skeleton" role="status" aria-label="Loading research">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="reel-grid" aria-hidden>
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton-reel">
            <Skeleton className="aspect-[4/5] w-full rounded-xl" />
            <Skeleton className="mt-4 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
