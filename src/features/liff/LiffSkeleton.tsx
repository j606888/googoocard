import { Skeleton } from "@/components/ui/skeleton";

const TITLE_WIDTHS = ["w-32", "w-24", "w-28", "w-20"];
const ROW_OPACITY = ["", "", "opacity-50", "opacity-25"];

/**
 * Loading placeholder for the student LIFF pages: a column of card rows
 * (title + sub line on the left, a short value on the right), fading downwards.
 */
export default function LiffSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4 ${
            ROW_OPACITY[i % ROW_OPACITY.length]
          }`}
        >
          <div className="flex flex-col gap-2">
            <Skeleton className={`h-4 ${TITLE_WIDTHS[i % TITLE_WIDTHS.length]}`} />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}
