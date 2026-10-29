import { Skeleton } from "@/components/ui/skeleton";

// 點名畫面載入中的骨架：跟載入後的版面同形狀（時段卡、搜尋列、名單），
// 只有資料區塊變成灰條；標題列等靜態外殼由 index.tsx 照常畫。

const PeriodInfoSkeleton = () => (
  <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
    <Skeleton className="h-5 w-28" />
    <Skeleton className="h-5 w-24" />
  </div>
);

const SearchbarSkeleton = () => (
  <div className="flex gap-2">
    <Skeleton className="h-12 flex-1 rounded-xl" />
    <Skeleton className="size-12 shrink-0 rounded-xl" />
  </div>
);

const NAME_WIDTHS = ["w-28", "w-20", "w-24", "w-16", "w-24", "w-20"];
const ROW_FADE = ["", "", "opacity-75", "opacity-50", "opacity-25", "opacity-25"];

const StudentOptionSkeleton = ({ index }: { index: number }) => (
  <div className={`flex items-center gap-3 px-3 h-[52px] ${ROW_FADE[index]}`}>
    <Skeleton className="size-8 rounded-full shrink-0" />
    <Skeleton className={`h-4 ${NAME_WIDTHS[index]}`} />
    <Skeleton className="ml-auto w-6 h-6 rounded-full shrink-0" />
  </div>
);

const RosterSkeleton = () => (
  <div className="flex flex-col gap-1.5">
    <div className="flex h-9 items-center">
      <Skeleton className="h-4 w-28" />
    </div>
    {Array.from({ length: 6 }).map((_, index) => (
      <StudentOptionSkeleton key={index} index={index} />
    ))}
  </div>
);

const PeriodAttendanceSkeleton = ({ variant }: { variant: "compact" | "expanded" }) => {
  if (variant === "expanded") {
    return (
      <div className="px-8 pb-8 grid grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <PeriodInfoSkeleton />
          <SearchbarSkeleton />
          <RosterSkeleton />
        </div>
        <div className="flex flex-col gap-4 sticky top-6">
          <Skeleton className="h-4 w-16" />
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-13 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-32 flex flex-col gap-3">
      <PeriodInfoSkeleton />
      <SearchbarSkeleton />
      <RosterSkeleton />
    </div>
  );
};

export default PeriodAttendanceSkeleton;
