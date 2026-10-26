import { Skeleton } from "@/components/ui/skeleton";

const ROW_WIDTHS = ["w-40", "w-28", "w-36"];

/** 價目表載入中：標題是真的，其他照載入後的分組表格畫。 */
const CardListSkeleton = () => (
  <div className="w-full max-w-[1080px] mx-auto px-5 py-4 lg:px-10 lg:py-10 flex flex-col gap-5 lg:gap-6" aria-busy="true">
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl lg:text-[28px] font-bold">課卡</h1>
        <Skeleton className="h-3.5 w-60" />
      </div>
      <Skeleton className="h-11 w-28 rounded-xl" />
    </div>
    <div className="flex items-end gap-6 border-b border-neutral-200 pb-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
    </div>
    {[3, 2].map((rows, group) => (
      <div key={group} className={`flex flex-col gap-2.5 ${group === 1 ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2.5 px-1">
          <Skeleton className="size-2.5" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="border border-neutral-200 rounded-2xl overflow-hidden">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 lg:px-5 py-4 border-b border-neutral-100 last:border-b-0">
              <div className="flex flex-col gap-2">
                <Skeleton className={`h-3.5 ${ROW_WIDTHS[i % ROW_WIDTHS.length]}`} />
                <Skeleton className="h-3 w-32 lg:hidden" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default CardListSkeleton;
