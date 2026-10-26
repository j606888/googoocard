"use client";

import { Suspense } from "react";
import NewLesson from "@/features/lessons/newLesson";
import { Skeleton } from "@/components/ui/skeleton";

const NewLessonPage = () => {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[1120px] px-5 py-6 lg:px-8 flex flex-col gap-5">
          <Skeleton className="h-6 w-28" />
          {["", "", "opacity-50", "opacity-25"].map((fade, index) => (
            <div key={index} className={`flex flex-col gap-1.5 lg:max-w-xl ${fade}`}>
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      }
    >
      <NewLesson />
    </Suspense>
  );
};

export default NewLessonPage;