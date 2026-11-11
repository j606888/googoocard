import Link from "next/link";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { TeacherOverviewRow } from "@/store/slices/teachers";
import TeacherAvatar from "./TeacherAvatar";
import { periodLabel } from "./format";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 「週四 20:30」：第一堂的星期與時間。 */
const slotLabel = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return `週${WEEKDAYS[date.getDay()]} ${format(date, "HH:mm")}`;
};

/** 桌面版的欄位：老師、下一堂、進行中、帳號、展開箭頭。表頭（`TeacherList`）用同一組。 */
export const TEACHER_ROW_COLUMNS =
  "lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_96px_minmax(0,1fr)_24px] lg:gap-4";

/**
 * 老師列表的一列：按一下展開，看他教的、協助的進行中課程（各自的時段），再進細節頁。
 */
const TeacherRow = ({
  teacher,
  open,
  onToggle,
  accountLabel,
  onInvite,
}: {
  teacher: TeacherOverviewRow;
  open: boolean;
  onToggle: () => void;
  /** 「你」／email／null = 沒有帳號。 */
  accountLabel: string | null;
  /** 管理員才有：邀請沒帳號的老師加入。 */
  onInvite?: () => void;
}) => {
  const archived = Boolean(teacher.archivedAt);
  const { nextPeriod, activeLessons, assistedLessons } = teacher;
  const panelId = `teacher-${teacher.id}-lessons`;

  return (
    <li className={open ? "bg-neutral-50/70" : undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 lg:px-5 ${TEACHER_ROW_COLUMNS} lg:items-center`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} size="sm" muted={archived} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold text-neutral-900">{teacher.name}</span>
              {archived && <StatusTag tone="neutral">已封存</StatusTag>}
            </span>
            {/* 手機：分部那一行換成下一堂。 */}
            <span className="truncate text-xs text-neutral-500 lg:hidden">
              {nextPeriod
                ? `${nextPeriod.ongoing ? "上課中" : periodLabel(nextPeriod.startTime)} · ${nextPeriod.lessonName}`
                : "目前沒有排課"}
            </span>
            {teacher.locations.length > 0 && (
              <span className="hidden truncate text-xs text-neutral-500 lg:block">
                {teacher.locations.map((l) => l.name).join("、")}
              </span>
            )}
          </span>
        </span>

        <span className="hidden min-w-0 flex-col gap-0.5 lg:flex">
          {nextPeriod ? (
            <>
              <span className={`truncate text-sm ${nextPeriod.ongoing ? "font-semibold text-primary-700" : ""}`}>
                {nextPeriod.ongoing ? "上課中" : periodLabel(nextPeriod.startTime)}
              </span>
              <span className="truncate text-xs text-neutral-500">{nextPeriod.lessonName}</span>
            </>
          ) : (
            <span className="text-sm text-neutral-500">目前沒有排課</span>
          )}
        </span>

        <span className="hidden text-sm lg:block">
          {activeLessons.length > 0 ? `${activeLessons.length} 門` : "—"}
        </span>

        <span
          className={`hidden truncate text-[13px] lg:block ${accountLabel ? "text-primary-700" : "text-neutral-500"}`}
        >
          {accountLabel ?? "沒有帳號"}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={`size-5 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id={panelId} className="grid gap-5 px-4 pt-1 pb-4 lg:grid-cols-2 lg:pr-5 lg:pl-[68px]">
          <LessonGroup title="教的課" lessons={activeLessons} empty="沒有進行中的課" />
          <div className="flex flex-col gap-3">
            <LessonGroup title="協助的課" lessons={assistedLessons} empty="—" />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/teachers/${teacher.id}`}>
                  看 {teacher.name} 的細節
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              {!accountLabel && onInvite && !archived && (
                <Button variant="ghost" size="sm" className="gap-1" onClick={onInvite}>
                  <Send className="size-3.5" />
                  邀請加入
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
};

const LessonGroup = ({
  title,
  lessons,
  empty,
}: {
  title: string;
  lessons: { id: number; name: string; danceStyle: DanceStyleSummary; firstStart: string | null }[];
  empty: string;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-neutral-500">{title}</span>
    {lessons.length === 0 ? (
      <span className="py-1.5 text-sm text-neutral-500">{empty}</span>
    ) : (
      <ul className="flex flex-col">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/lessons/${lesson.id}`}
              className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-white"
            >
              <span className={`size-2 shrink-0 rounded-full ${danceStyleMeta(lesson.danceStyle).dot}`} />
              <span className="flex-1 truncate">{lesson.name}</span>
              <span className="shrink-0 text-xs text-neutral-500">{slotLabel(lesson.firstStart) ?? ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default TeacherRow;
