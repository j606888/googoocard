import { Skeleton } from "@/components/ui/skeleton";

const CardListSkeleton = () => (
  <div className="w-full max-w-[1080px] mx-auto px-5 py-4 lg:px-10 lg:py-10 flex flex-col gap-6">
    <div className="flex items-end justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-11 w-28 rounded-lg" />
    </div>
    <Skeleton className="h-10 w-full rounded-lg" />
    {[3, 2].map((rows, group) => (
      <div key={group} className="flex flex-col gap-2.5">
        <Skeleton className="h-5 w-32" />
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 last:border-b-0">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default CardListSkeleton;
