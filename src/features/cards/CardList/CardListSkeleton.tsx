import { Skeleton } from "@/components/ui/skeleton";

const CardListSkeleton = () => {
  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg mb-4" />
      <Skeleton className="h-5 w-28 mb-3" />
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
    <div className="border border-neutral-200 border-l-4 border-l-neutral-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="flex items-center justify-between mt-3.5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="border-t border-neutral-100 mt-3.5 pt-3 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </div>
  );
};

export default CardListSkeleton;
