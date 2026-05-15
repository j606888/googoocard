import { Skeleton } from "@/components/ui/skeleton";

const CardListSkeleton = () => {
  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="h-5 w-36 mb-3" />
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
};

const CardSkeleton = () => {
  return (
    <div className="border border-gray-200 border-l-4 border-l-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-7 w-8" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-18" />
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  );
};

export default CardListSkeleton;
