"use client";

import Link from "next/link";
import { lessonDropInOptions } from "@/lib/dropInOptions";
import { format, isToday } from "date-fns";
import { ArrowLeft, Check, PencilLine } from "lucide-react";
import { Lesson } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { lessonLevelLabel } from "@/lib/danceLevels";
import { lessonPeopleLabel } from "@/lib/teachers";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { weeklyScheduleLabel } from "../lessonSchedule";

/**
 * Desktop lesson header: breadcrumb, the name with its status, and one quiet
 * line of facts. The old tinted block with a row of stat pills is gone — the
 * numbers now live next to what they describe (rate on the chart, headcount on
 * the roster, period count on the period column).
 */
const LessonDetailHeader = ({
  lesson,
  onEdit,
}: {
  lesson: Lesson;
  onEdit: () => void;
}) => {
  const style = danceStyleMeta(lesson.danceStyle);
  const levelLabel = lessonLevelLabel(lesson.danceStyle, lesson.level);
  const isFinished = lesson.status === "finished";
  const periods = lesson.periods ?? [];
  const todayPeriod = isFinished
    ? undefined
    : periods.find((p) => !p.attendanceTakenAt && isToday(new Date(p.startTime)));
  const schedule = weeklyScheduleLabel(periods);

  const facts = [
    lesson.kind === "ongoing" ? "持續開課" : "固定期數",
    lessonPeopleLabel(lesson.teachers, lesson.assistants),
    lesson.location?.name ?? null,
    schedule,
    lesson.sessionsPerAttendance > 1 ? `每次扣 ${lesson.sessionsPerAttendance} 格` : null,
    lesson.dropInPrice !== null
      ? `單堂 ${lessonDropInOptions(lesson)
          .map((o) => `$${o.price.toLocaleString()}`)
          .join("／")}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <header className="flex flex-col gap-3.5">
      <nav aria-label="麵包屑" className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/lessons" className="flex items-center gap-1 hover:text-neutral-800">
          <ArrowLeft className="size-4" />
          課程
        </Link>
        {lesson.group && lesson.group.name !== lesson.name && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/lessons/groups/${lesson.group.id}`} className="hover:text-neutral-800">
              {lesson.group.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="max-w-xs truncate text-neutral-800">{lesson.name}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">{lesson.name}</h1>
            <StatusTag tone={isFinished ? "neutral" : "positive"}>{isFinished ? "已結束" : "進行中"}</StatusTag>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
            <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-900">
              <span className={`size-2.5 rounded-[3px] ${style.bg}`} />
              {[style.label, levelLabel].filter(Boolean).join(" ")}
            </span>
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={onEdit}>
            <PencilLine className="size-4" />
            編輯課程
          </Button>
          {todayPeriod && (
            <Button asChild>
              <Link href={`/lessons/${lesson.id}/periods/${todayPeriod.id}/check`}>
                <Check className="size-4" />
                點名 · 今天 {format(new Date(todayPeriod.startTime), "HH:mm")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default LessonDetailHeader;
