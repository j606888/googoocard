import { cn } from "@/lib/utils"

/**
 * A loading placeholder block: neutral-100 (override with `bg-*`) with a slow shimmer (`.sk-shimmer` in globals.css,
 * static under reduced motion). Pill-shaped by default — text lines are pills; pass `rounded-*`
 * for avatars (`rounded-full`), tags, or cells (`rounded-sm`). Draw only the data that is
 * loading; real titles, search boxes and table headers render as themselves
 * (docs/design-system.md「骨架」).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("sk-shimmer bg-neutral-100 rounded-full", className)}
      {...props}
    />
  )
}

export { Skeleton }
