"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SubNavbar from "@/features/SubNavbar";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { studentDetailHref } from "@/lib/studentNav";
import { cn } from "@/lib/utils";
import {
  useGetLessonGroupStudentsQuery,
  useGetLessonGroupsQuery,
} from "@/store/slices/lessonGroups";
import { useGetLessonsQuery, type LessonSummary } from "@/store/slices/lessons";
import { stashLessonClone } from "./lessonClone";
import { termProgress } from "./lessonSeries";
import { slotLabel, termNumbers, termRangeLabel } from "./termLabels";

type Student = { id: number; name: string; avatarUrl: string };

const TermRow = ({
  lesson,
  number,
  seriesName,
  students,
}: {
  lesson: LessonSummary;
  number: number;
  seriesName: string;
  students: Student[] | undefined;
}) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const running = lesson.status === "inProgress";
  const assistants = (lesson.assistants ?? []).map((t) => t.name).join("、");
  const panelId = `term-${lesson.id}`;

  return (
    <li className="border-t border-neutral-100 first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("mt-0.5 size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-90")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-neutral-900">第 {number} 期</span>
            {lesson.name !== seriesName && <span className="text-sm text-neutral-700">{lesson.name}</span>}
            <span className={cn("text-[13px] font-medium", running ? "text-primary-700" : "text-neutral-600")}>
              {running ? "開課中" : "已結束"}
            </span>
          </span>
          <span className="block text-[13px] text-neutral-700">
            {[termRangeLabel(lesson), slotLabel(lesson), lesson.location?.name].filter(Boolean).join(" · ")}
          </span>
          <span className="block text-xs text-neutral-600">
            {[
              lesson.teachers.map((t) => t.name).join("、"),
              assistants && `小幫手 ${assistants}`,
              termProgress(lesson),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-sm tabular-nums text-neutral-700">{lesson.studentCount} 人</span>
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-3 bg-neutral-50 px-4 py-3 lg:pl-11">
          {students === undefined ? (
            <Skeleton className="h-8 w-2/3" />
          ) : students.length === 0 ? (
            <p className="text-sm text-neutral-600">這一期還沒有人上過課。</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {students.map((student) => (
                <li key={student.id}>
                  <Link
                    href={studentDetailHref(student.id, pathname)}
                    className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1 pr-3 pl-1 text-sm text-neutral-800 hover:border-neutral-300"
                  >
                    <Image
                      src={student.avatarUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 rounded-full"
                    />
                    {student.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/lessons/${lesson.id}`} className="self-start text-sm font-medium text-primary-700">
            進這一期的課程頁
          </Link>
        </div>
      )}
    </li>
  );
};

/**
 * 課種頁：這個課種開過幾期、各分部各開幾期、現在還有沒有在開；
 * 每一期點開看上過課的學生。
 */
const GroupDetail = () => {
  const { groupId } = useParams();
  const router = useRouter();
  const numericGroupId = Number(groupId);

  const { data: groups, isLoading: isGroupsLoading } = useGetLessonGroupsQuery();
  const group = groups?.find((g) => g.id === numericGroupId);
  const title = group?.name ?? "";

  const { data, isLoading: isLessonsLoading } = useGetLessonsQuery({
    tab: "all",
    sort: "nextSession",
    groupId: numericGroupId,
  });
  const { data: roster } = useGetLessonGroupStudentsQuery(numericGroupId, {
    skip: Number.isNaN(numericGroupId),
  });

  const lessons = data?.lessons ?? [];
  const numbers = termNumbers(lessons);
  const ordered = [...lessons].sort((a, b) => numbers.get(b.id)! - numbers.get(a.id)!);
  const running = lessons.filter((l) => l.status === "inProgress");
  const perLocation = new Map<string, number>();
  for (const lesson of lessons) {
    const name = lesson.location?.name ?? "未設分部";
    perLocation.set(name, (perLocation.get(name) ?? 0) + 1);
  }
  const studentsOf = new Map(roster?.lessons.map((l) => [l.lessonId, l.students]));
  const totalStudents = new Set(roster?.lessons.flatMap((l) => l.students.map((s) => s.id))).size;
  const style = ordered[0]?.danceStyle;

  const openNewTerm = () => {
    if (ordered[0]) {
      stashLessonClone(ordered[0]);
      router.push("/lessons/new");
    } else {
      router.push(`/lessons/new?groupId=${numericGroupId}`);
    }
  };

  const isLoading = isGroupsLoading || isLessonsLoading;

  return (
    <>
      <SubNavbar title={title} backUrl="/lessons" className="lg:hidden" />
      <div className="flex w-full max-w-[960px] flex-col gap-5 px-5 pt-4 pb-8 lg:px-8 lg:pt-6">
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/lessons" aria-label="回課程" className="text-neutral-500 hover:text-neutral-700">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        </div>

        {isLoading ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl opacity-60" />
          </div>
        ) : !group ? (
          <EmptyState kind="inline" title="找不到這個課種" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                  {style && (
                    <span aria-hidden="true" className={cn("size-2.5 rounded-full", danceStyleMeta(style).bg)} />
                  )}
                  共 {lessons.length} 期
                  <span className={running.length > 0 ? "text-primary-700" : "text-neutral-600"}>
                    {running.length > 1
                      ? `${running.length} 期開課中`
                      : running.length === 1
                        ? `第 ${numbers.get(running[0].id)} 期開課中`
                        : "已停"}
                  </span>
                </p>
                <p className="text-[13px] text-neutral-700">
                  {[
                    style && danceStyleMeta(style).label,
                    [...perLocation].map(([name, count]) => `${name} ${count} 期`).join("、"),
                    totalStudents > 0 && `${totalStudents} 位學生上過`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button variant="secondary" size="sm" className="gap-1" onClick={openNewTerm}>
                <Plus className="size-4" />
                開新一期
              </Button>
            </div>

            {ordered.length === 0 ? (
              <EmptyState kind="inline" title="這個課種還沒開過" />
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {ordered.map((lesson) => (
                  <TermRow
                    key={lesson.id}
                    lesson={lesson}
                    number={numbers.get(lesson.id)!}
                    seriesName={group.name}
                    students={roster ? (studentsOf.get(lesson.id) ?? []) : undefined}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default GroupDetail;
