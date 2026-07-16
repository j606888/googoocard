"use client";

import { BookOpenText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import TabAndSort from "./TabAndSort";
import LessonCard from "./LessonCard";
import { useEffect, useState } from "react";
import { DanceType } from "@prisma/client";

const LessonsList = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inProgress");
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [page, setPage] = useState(1);

  // Debounce the search input before it hits the query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change restarts pagination from the first page.
  useEffect(() => {
    setPage(1);
  }, [activeTab, sort, debouncedSearch, danceType]);

  const { data: lessons, isLoading, isFetching } = useGetLessonsQuery({
    tab: activeTab,
    sort,
    search: debouncedSearch,
    danceType,
    page,
  });

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Lessons</h2>
        <button
          className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
          onClick={() => router.push("/lessons/new")}
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">New Lesson</span>
        </button>
      </div>

      <TabAndSort
        tabsCount={lessons?.tabsCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sort={sort}
        setSort={setSort}
        search={search}
        setSearch={setSearch}
        danceType={danceType}
        setDanceType={setDanceType}
        availableDanceTypes={lessons?.availableDanceTypes ?? []}
      />

      {isLoading ? (
        <ListSkeleton />
      ) : lessons?.lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 gap-3 bg-primary-50 rounded-2xl">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <BookOpenText className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">
              {debouncedSearch || danceType ? "No matching lessons" : "No lessons yet"}
            </p>
            <p className="text-sm text-neutral-500 text-center">
              {debouncedSearch || danceType
                ? "Try a different search or filter."
                : "Create lesson to start teaching!"}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {lessons?.lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
          {lessons?.hasNextPage && (
            <div className="flex justify-center mt-5">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="px-5 py-2 rounded-full border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                {isFetching ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LessonsList;
