import { Skeleton } from "@/components/ui/skeleton";

const ROW_WIDTHS = ["w-40", "w-28", "w-36"];

/** 價目表載入中：標題是真的，其他照載入後的分組清單畫（沒有外框）。 */
const CardListSkeleton = () => (
  <div className="flex w-full flex-col px-5 pt-5 pb-10 lg:max-w-[1180px] lg:px-12 lg:pt-9" aria-busy="true">
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-[28px] font-semibold text-ink lg:text-[26px]">課卡</h1>
      <Skeleton className="h-11 w-28 rounded-xl" />
    </div>
    <div className="mt-5 flex items-center gap-4">
      <Skeleton className="h-9 w-44 rounded-lg" />
      <Skeleton className="h-4 w-20" />
    </div>
    {[3, 2].map((rows, group) => (
      <div key={group} className={`mt-8 lg:mt-9 ${group === 1 ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2.5 py-2">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-1 divide-y divide-line border-b border-line">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex min-h-14 items-center justify-between gap-4 py-2 lg:min-h-13">
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
