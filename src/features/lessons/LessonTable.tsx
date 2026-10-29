"use client";
import LocationBadge from "@/components/LocationBadge";

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const formatDay = (date: Date) => {
  if (isToday(date)) return "今天";
  if (isTomorrow(date)) return "明天";
  return `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）`;
};

/**
 * 「下一堂」那格：還沒開始的下一堂 > 已結束 / 尚未排。永遠不寫過去的日期——
 * 逾期沒點名的時段在列表上方的「還沒點名」與這一列的「補點名」按鈕。
 */
const NextCell = ({ lesson }: { lesson: LessonSummary }) => {
  if (lesson.nextSessionDate) {
    const next = new Date(lesson.nextSessionDate);
    const until = daysUntilLabel(next, new Date());
    return (
      <>
        <span className="lg:hidden text-neutral-500 shrink-0">下一堂</span>
        <span className="truncate">{`${formatDay(next)} ${format(next, "HH:mm")}`}</span>
        {until && <span className="text-neutral-500 shrink-0">· {until}</span>}
      </>
    );
  }
  if (lesson.status === "finished" && lesson.lastPeriodEnd) {
    return <span className="text-neutral-500">{format(new Date(lesson.lastPeriodEnd), "M/d")} 結束</span>;
  }
  return (
    <span className="text-neutral-500 truncate">
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
  if (lesson.totalPeriods === 0) return <span className="text-neutral-500">—</span>;
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
      <span className="lg:hidden text-neutral-500 shrink-0">期間</span>
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
      locationId: lesson.location?.id ?? null,
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
            <LocationBadge location={lesson.location} className="text-[11px]" />
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
          <Users className="lg:hidden w-3.5 h-3.5 text-neutral-500" />
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
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/lessons/${lesson.id}/periods/${action.periodId}/check`);
              }}
              className="lg:ml-auto"
            >
              <AlarmClock className="size-4" />
              {lesson.dueForAttendanceIsBacklog ? "補點名" : "點名"}
            </Button>
          );
        }
        if (action.type === "schedule") {
          return (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setScheduling(lesson);
              }}
              className="lg:ml-auto gap-1"
            >
              <Plus className="size-4" />
              下一堂
            </Button>
          );
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleClone(lesson);
            }}
            className="lg:ml-auto max-lg:w-9 max-lg:px-0 lg:border-[1.5px] lg:border-neutral-200 text-neutral-600 hover:text-primary-700 hover:bg-primary-50"
            aria-label={`複製「${lesson.name}」開新一期`}
            title="複製這門課的設定，開新一期"
          >
            <Copy className="w-4 h-4 lg:hidden" />
            <span className="max-lg:sr-only">複製開新期</span>
          </Button>
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

const SKELETON_COLUMNS = [
  { header: "課程", width: "minmax(0,2.4fr)" },
  { header: "舞種 · 程度", width: "minmax(0,1.1fr)" },
  { header: "學生", width: "64px" },
  { header: "進度", width: "minmax(0,1.3fr)" },
  { header: "下一堂", width: "minmax(0,1.4fr)" },
  { header: "", width: "128px" },
];
const SKELETON_ROWS = [
  { name: "w-36", fade: "" },
  { name: "w-28", fade: "" },
  { name: "w-32", fade: "opacity-75" },
  { name: "w-24", fade: "opacity-50" },
  { name: "w-28", fade: "opacity-25" },
];

/** 載入中：跟 `LessonTable`（DataView）同一個外框與真的表頭，只有資料列是骨架。 */
export const LessonTableSkeleton = () => {
  const trackVars = {
    "--dv-cols-compact": "minmax(0,1fr) auto",
    "--dv-cols-expanded": SKELETON_COLUMNS.map((c) => c.width).join(" "),
  } as React.CSSProperties;
  const grid =
    "grid grid-cols-[var(--dv-cols-compact)] lg:grid-cols-[var(--dv-cols-expanded)] gap-x-3 gap-y-2 lg:gap-3";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden" aria-busy="true">
      <div
        style={trackVars}
        className={`${grid} hidden lg:grid px-4.5 py-2.5 bg-neutral-50 border-b border-neutral-100 text-xs font-semibold text-neutral-500`}
      >
        {SKELETON_COLUMNS.map((c) => (
          <div key={c.header || "action"}>{c.header}</div>
        ))}
      </div>
      {SKELETON_ROWS.map((row, index) => (
        <div
          key={index}
          style={trackVars}
          className={`${grid} items-center px-3.5 py-3 lg:px-4.5 lg:py-3.5 border-b border-neutral-100 last:border-b-0 ${row.fade}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton className="w-1 h-9 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className={`h-3.5 ${row.name}`} />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:contents">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="col-start-2 row-start-1 lg:col-auto lg:row-auto flex justify-end">
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LessonTable;
