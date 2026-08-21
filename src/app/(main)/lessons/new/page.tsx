"use client";

import { Suspense } from "react";
import NewLesson from "@/features/lessons/newLesson";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

const NewLessonPage = () => {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <NewLesson />
    </Suspense>
  );
};

export default NewLessonPage;