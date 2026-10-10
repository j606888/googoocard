"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isToday, isTomorrow } from "date-fns";
import { AlarmClock, Copy, Plus, Repeat, Users } from "lucide-react";
import DataView, { DataViewColumn } from "@/components/DataView";
import { LessonSummary } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { lessonLevelLabel } from "@/lib/danceLevels";
import { setLessonCloneSource } from "@/lib/lessonDraftStorage";
import { daysUntilLabel, formatPeriodRange, lessonRowAction } from "./lessonGrouping";
import NextPeriodDrawer from "./NextPeriodDrawer";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const formatDay = (date: Date) => {
  if (isToday(date)) return "今天";
  if (isTomorrow(date)) return "明天";
  return `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）`;
};

/** 「下一堂」那格：待點名 > 下一堂 > 已結束 / 尚未排。 */
const NextCell = ({ lesson }: { lesson: LessonSummary }) => {
  if (lesson.dueForAttendanceCount > 0 && lesson.dueForAttendanceDate) {
    const due = new Date(lesson.dueForAttendanceDate);
    return (
      <span className="font-semibold text-warning-700 truncate">
        {lesson.dueForAttendanceIsBacklog
          ? `${formatDay(due)} 未點名`
          : `${formatDay(due)} ${format(due, "HH:mm")}`}
        {lesson.dueForAttendanceCount > 1 && ` · ${lesson.dueForAttendanceCount} 堂待點名`}
      </span>
    );
  }
  if (lesson.nextSessionDate) {
    const next = new Date(lesson.nextSessionDate);
    const until = daysUntilLabel(next, new Date());
    return (
      <>
        <span className="lg:hidden text-neutral-400 shrink-0">下一堂</span>
        <span className="truncate">{`${formatDay(next)} ${format(next, "HH:mm")}`}</span>
        {until && <span className="text-neutral-500 shrink-0">· {until}</span>}
      </>
    );
  }
  if (lesson.status === "finished" && lesson.lastPeriodEnd) {
    return <span className="text-neutral-400">{format(new Date(lesson.lastPeriodEnd), "M/d")} 結束</span>;
  }
  return (
    <span className="text-neutral-400 truncate">
      尚未排
      {lesson.lastPeriodStart && ` · 上次 ${format(new Date(lesson.lastPeriodStart), "M/d")}`}
    </span>
  );
};

const ProgressCell = ({ lesson }: { lesson: LessonSummary }) => {
  if (lesson.kind === "ongoing") {
    return (
      <span className="flex items-center gap-1 text-neutral-500 min-w-0">
        <Repeat className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">持續開課 · 已上 {lesson.attendedCount} 堂</span>
      </span>
    );
  }
  if (lesson.totalPeriods === 0) return <span className="text-neutral-400">—</span>;
  const pct = Math.round((lesson.attendedCount / lesson.totalPeriods) * 100);
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="hidden lg:block h-1.5 w-20 rounded-full bg-neutral-200 overflow-hidden shrink-0">
        <span
          className={`block h-full rounded-full ${danceStyleMeta(lesson.danceStyle).bg}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular-nums text-neutral-500 shrink-0">
        {lesson.attendedCount} / {lesson.totalPeriods} 堂
      </span>
    </span>
  );
};

/** 已結束的課：期間取代「下一堂」，同名的課才分得出是哪一期。 */
const PeriodRangeCell = ({ lesson }: { lesson: LessonSummary }) => {
  const range = formatPeriodRange(lesson.firstPeriodStart, lesson.lastPeriodEnd, new Date());
  return (
    <>
      <span className="lg:hidden text-neutral-400 shrink-0">期間</span>
      <span className="truncate text-neutral-600">{range ?? "—"}</span>
    </>
  );
};

/**
 * 課程列表（一個群組底下、或攤平的整份）。欄位定義給 `DataView`，
 * 手機是卡片、桌面是表格，共用同一份 DOM。
 * `variant="finished"`：已結束分頁，最後一欄顯示期間而不是下一堂。
 */
const LessonTable = ({
  lessons,
  variant = "active",
}: {
  lessons: LessonSummary[];
  variant?: "active" | "finished";
}) => {
  const router = useRouter();
  const [scheduling, setScheduling] = useState<LessonSummary | null>(null);

  const handleClone = (lesson: LessonSummary) => {
    const initialPeriod =
      lesson.lastPeriodStart && lesson.lastPeriodEnd
        ? {
            startTime: addDays(new Date(lesson.lastPeriodStart), 7).toISOString(),
            endTime: addDays(new Date(lesson.lastPeriodEnd), 7).toISOString(),
          }
        : undefined;
    setLessonCloneSource({
      lessonName: lesson.name,
      teacherIds: lesson.teachers.map((t) => t.id),
      cardIds: lesson.cardIds,
      danceStyleId: lesson.danceStyleId,
      level: lesson.level,
      kind: lesson.kind,
      groupId: lesson.groupId,
      initialPeriod,
    });
    router.push("/lessons/new");
  };

  const columns: DataViewColumn<LessonSummary>[] = [
    {
      key: "name",
      header: "課程",
      width: "minmax(0,2.4fr)",
      role: "primary",
      render: (lesson) => (
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-1 self-stretch min-h-9 rounded-full shrink-0 ${danceStyleMeta(lesson.danceStyle).bg}`}
          />
          <div className="min-w-0">
            <div className="text-sm lg:text-[15px] font-semibold text-neutral-900 truncate">
              {lesson.name}
            </div>
            {lesson.teachers.length > 0 && (
              <div className="text-xs text-neutral-500 truncate">
                {lesson.teachers.map((t) => t.name).join(", ")}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "style",
      header: "舞種 · 程度",
      width: "minmax(0,1.1fr)",
      render: (lesson) => {
        const meta = danceStyleMeta(lesson.danceStyle);
        const level = lessonLevelLabel(lesson.danceStyle, lesson.level);
        return (
          <>
            <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>
              {meta.label}
            </span>
            {level && <span className="text-neutral-500 shrink-0">{level}</span>}
          </>
        );
      },
    },
    {
      key: "students",
      header: "學生",
      width: "64px",
      render: (lesson) => (
        <>
          <Users className="lg:hidden w-3.5 h-3.5 text-neutral-400" />
          <span className="tabular-nums">{lesson.studentCount}</span>
        </>
      ),
    },
    {
      key: "progress",
      header: "進度",
      width: "minmax(0,1.3fr)",
      render: (lesson) => <ProgressCell lesson={lesson} />,
    },
    variant === "finished"
      ? {
          key: "range",
          header: "期間",
          width: "minmax(0,1.4fr)",
          render: (lesson) => <PeriodRangeCell lesson={lesson} />,
        }
      : {
          key: "next",
          header: "下一堂",
          width: "minmax(0,1.4fr)",
          render: (lesson) => <NextCell lesson={lesson} />,
        },
    {
      key: "action",
      header: "",
      width: "128px",
      role: "trailing",
      render: (lesson) => {
        const action = lessonRowAction(lesson);
        if (action.type === "attend") {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/lessons/${lesson.id}/periods/${action.periodId}/check`);
              }}
              className="lg:ml-auto flex items-center gap-1.5 shrink-0 bg-warning-700 hover:bg-warning-600 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <AlarmClock className="w-4 h-4" />
              {lesson.dueForAttendanceIsBacklog ? "補點名" : "點名"}
            </button>
          );
        }
        if (action.type === "schedule") {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setScheduling(lesson);
              }}
              className="lg:ml-auto flex items-center gap-1 shrink-0 border border-primary-500 text-primary-700 bg-white hover:bg-primary-50 text-sm font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              下一堂
            </button>
          );
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClone(lesson);
            }}
            className="lg:ml-auto flex items-center gap-1.5 shrink-0 p-2 lg:px-3 lg:py-1.5 lg:border lg:border-neutral-200 text-neutral-500 hover:text-primary-700 hover:bg-primary-50 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            aria-label={`複製「${lesson.name}」開新一期`}
            title="複製這門課的設定，開新一期"
          >
            <Copy className="w-4 h-4 lg:hidden" />
            <span className="max-lg:sr-only">複製開新期</span>
          </button>
        );
      },
    },
  ];

  return (
    <>
      <DataView
        columns={columns}
        rows={lessons}
        rowKey={(lesson) => lesson.id}
        onRowClick={(lesson) => router.push(`/lessons/${lesson.id}`)}
      />
      {scheduling && (
        <NextPeriodDrawer lesson={scheduling} onClose={() => setScheduling(null)} />
      )}
    </>
  );
};

export default LessonTable;
