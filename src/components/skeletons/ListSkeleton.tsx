import { Skeleton } from "@/components/ui/skeleton";

const ListSkeleton = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <Skeleton className="h-6 w-40 mb-6" />
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
};

const CardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg border-1 border-neutral-100 p-4 shadow-xs">
      <div className="flex items-start justify-between mb-6">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="text-center">
          <Skeleton className="h-8 w-8 mx-auto mb-2" />
          <Skeleton className="h-4 w-12 mx-auto" />
        </div>
        <div className="text-center">
          <Skeleton className="h-8 w-8 mx-auto mb-2" />
          <Skeleton className="h-4 w-16 mx-auto" />
        </div>
        <div className="text-center">
          <Skeleton className="h-8 w-8 mx-auto mb-2" />
          <Skeleton className="h-4 w-20 mx-auto" />
        </div>
      </div>
    </div>
  );
};
export default ListSkeleton;

/**
 * 課程列表載入中的骨架：跟 `DataView` 同一個樣子——手機是卡片、桌面是表格列。
 * （舊的 `ListSkeleton` 是卡片版型，表格上線後兩者對不起來。）
 */
export const TableSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="flex flex-col gap-3 lg:gap-0 lg:rounded-2xl lg:border lg:border-neutral-200 lg:overflow-hidden">
    <div className="hidden lg:flex items-center gap-6 px-5 py-3 bg-neutral-50">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-14" />
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-3 w-12" />
    </div>
    {Array.from({ length: rows }, (_, i) => (
      <div
        key={i}
        className="flex flex-col gap-3 rounded-2xl border border-neutral-100 p-4 lg:flex-row lg:items-center lg:gap-6 lg:rounded-none lg:border-0 lg:border-t lg:border-neutral-100 lg:px-5 lg:py-4"
      >
        <div className="flex flex-col gap-1.5 lg:w-1/3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-3 lg:flex-1 lg:gap-6">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    ))}
  </div>
);
