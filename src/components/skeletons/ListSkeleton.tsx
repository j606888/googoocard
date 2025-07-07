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
    <div className="bg-white rounded-lg border-1 border-gray-100 p-4 shadow-xs">
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
