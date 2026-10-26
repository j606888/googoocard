"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Users, BookOpenText } from "lucide-react";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import SubNavbar from "@/features/SubNavbar";
import TimeSlotCard from "./TimeSlotCard";

const GroupDetail = () => {
  const { groupId } = useParams();
  const router = useRouter();
  const isUngrouped = groupId === "ungrouped";
  const numericGroupId = isUngrouped ? null : Number(groupId);

  const { data: groups, isLoading: isGroupsLoading } = useGetLessonGroupsQuery();
  const group = isUngrouped ? null : groups?.find((g) => g.id === numericGroupId);
  const title = isUngrouped ? "未分類" : group?.name ?? "";

  // No status tabs here — a group is browsed as one day's whole schedule,
  // in-progress and finished slots together (tab="all" skips the status filter).
  const { data: lessons, isLoading: isLessonsLoading } = useGetLessonsQuery({
    tab: "all",
    sort: "nextSession",
    groupId: numericGroupId,
  });

  const isLoading = isGroupsLoading || isLessonsLoading;
  const studentCount = lessons?.lessons.reduce((sum, l) => sum + l.studentCount, 0) ?? 0;

  return (
    <>
      <SubNavbar title={title} backUrl="/lessons" className="lg:hidden" />

      {/* Desktop: inline page header, matching NewLesson's lightweight treatment */}
      <div className="hidden lg:flex w-full max-w-[1120px] items-center gap-3 px-8 pt-6 pb-2">
        <Link href="/lessons" className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
      </div>

      {isLoading ? (
        <div className="w-full max-w-[1120px] px-5 py-3 lg:px-8 lg:py-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {["", "", "opacity-50", "opacity-25"].map((fade, i) => (
              <div
                key={i}
                className={`flex items-stretch rounded-2xl border border-neutral-200 overflow-hidden ${fade}`}
              >
                <div className="w-1.5 shrink-0 bg-neutral-100" />
                <div className="flex flex-col gap-2.5 p-3.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className={`h-3.5 ${i % 2 ? "w-24" : "w-32"}`} />
                  </div>
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[1120px] px-5 py-3 lg:px-8 lg:py-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5 text-xs text-neutral-600">
              <BookOpenText className="w-3.5 h-3.5" />
              {lessons?.lessons.length ?? 0} 堂課
            </div>
            {studentCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-full px-3 py-1.5 text-xs text-neutral-600">
                <Users className="w-3.5 h-3.5" />
                {studentCount} 位學生
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {lessons?.lessons.map((lesson) => (
              <TimeSlotCard key={lesson.id} lesson={lesson} />
            ))}
          </div>

          <Button
            onClick={() =>
              router.push(isUngrouped ? "/lessons/new" : `/lessons/new?groupId=${numericGroupId}`)
            }
            variant="ghost"
            className="w-full h-12 rounded-2xl border-[1.5px] border-dashed border-neutral-300 text-neutral-500 hover:bg-transparent hover:border-neutral-400 hover:text-neutral-700"
          >
            <Plus className="w-4 h-4" />
            {isUngrouped ? "新增課程" : "新增這天的堂"}
          </Button>
        </div>
      )}
    </>
  );
};

export default GroupDetail;
