"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { LessonSummary } from "@/store/slices/lessons";
import { Skeleton } from "@/components/ui/skeleton";
import { nextDateLabel } from "./lessonSchedule";

const metaFor = (lesson: LessonSummary) =>
  [
    lesson.teachers.map((t) => t.name).join("、"),
    lesson.kind === "ongoing" ? "持續開課" : `${lesson.attendedCount}/${lesson.totalPeriods} 堂`,
  ]
    .filter(Boolean)
    .join(" · ");

/** 下一堂排在前面，沒排的放最後；同時間照名字。 */
export const byNextSession = (a: LessonSummary, b: LessonSummary) => {
  const at = a.nextSessionDate ? new Date(a.nextSessionDate).getTime() : Infinity;
  const bt = b.nextSessionDate ? new Date(b.nextSessionDate).getTime() : Infinity;
  return at - bt || a.name.localeCompare(b.name, "zh-Hant");
};

/**
 * 手機的進行中課程：安靜的一列一門課——舞種色點、名稱、老師與進度、下一堂。
 * 要做事的（點名）已經在上面的深綠卡與「還沒點名」，這裡只負責「去那門課」。
 */
const ActiveLessonRows = ({ lessons, now }: { lessons: LessonSummary[]; now: Date }) => (
  <ul>
    {[...lessons].sort(byNextSession).map((lesson) => (
      <li key={lesson.id}>
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex h-14 items-center gap-3 border-b border-neutral-200 text-neutral-900"
        >
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${danceStyleMeta(lesson.danceStyle).bg}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{lesson.name}</span>
            <span className="block truncate text-xs text-neutral-500">{metaFor(lesson)}</span>
          </span>
          <span className="shrink-0 text-[13px] text-neutral-600">
            {lesson.nextSessionDate ? nextDateLabel(new Date(lesson.nextSessionDate), now) : "還沒排"}
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
        </Link>
      </li>
    ))}
  </ul>
);

const SKELETON_FADE = ["", "", "opacity-75", "opacity-50", "opacity-25"];

export const ActiveLessonRowsSkeleton = () => (
  <div aria-busy="true">
    {SKELETON_FADE.map((fade, index) => (
      <div key={index} className={`flex h-14 items-center gap-3 border-b border-neutral-200 ${fade}`}>
        <Skeleton className="size-2.5 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className={`h-3.5 ${index % 2 ? "w-28" : "w-36"}`} />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-10" />
      </div>
    ))}
  </div>
);

export default ActiveLessonRows;
