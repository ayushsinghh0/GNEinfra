import { Skeleton } from "@/components/ui";

/* Shared skeleton scaffold for /hr route `loading.tsx` boundaries.
   Before these existed, clicking a sidebar/nav link gave ZERO feedback until
   the whole server payload landed — the single biggest "the app feels slow"
   driver. Each route's loading.tsx renders this instantly on navigation.
   Shape mirrors the common HR page anatomy: sticky header bar → stat strip →
   toolbar → list block. `variant` trims the parts a page doesn't have. */
export default function RouteLoading({
  variant = "list",
}: {
  variant?: "list" | "dashboard" | "detail";
}) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {/* PageHeader stand-in */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200/70 px-6 sm:px-8">
        <Skeleton className="h-6 w-44" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {variant === "dashboard" && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {variant === "list" && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-12 rounded-2xl" />
          </>
        )}

        {variant === "detail" && (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-9 w-96 max-w-full rounded-xl" />
          </div>
        )}

        {/* main content block */}
        <div className="space-y-2 rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
