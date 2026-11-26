import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, CircleAlert } from "lucide-react";
import type { LessonAttendance } from "@/store/slices/students";
import DanceBadge from "../../StudentList/DanceBadge";
import { formatCardSerial } from "@/lib/cardSerial";
import {
  buildTimelineAxis,
  lessonWeekCells,
  periodStatus,
  sortLessons,
  summarizeLesson,
  type PeriodStatus,
  type TimelineAxis,
  type WeekCell,
} from "./lessonTimeline";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const CELL_CLASS: Record<WeekCell, string> = {
  attended: "bg-primary-600",
  absent: "bg-white border-2 border-danger-600",
  unchecked: "bg-white border border-dashed border-ink-3/60",
  gap: "bg-[radial-gradient(circle,var(--color-neutral-300)_1.5px,transparent_2px)]",
  none: "",
};

const CELL_TITLE: Record<WeekCell, string> = {
  attended: "出席",
  absent: "缺席",
  unchecked: "未點名",
  gap: "該週沒課",
  none: "",
};

/** 每一堂的狀態寫成字，不用膠囊：待確認要處理（琥珀）、缺席紅字、未點名淡字。 */
const STATUS_TEXT: Record<PeriodStatus | "pending", { label: string; className: string }> = {
  attended: { label: "出席", className: "text-ink-2" },
  pending: { label: "待確認", className: "font-semibold text-warning-800" },
  absent: { label: "缺席", className: "font-semibold text-danger-700" },
  unchecked: { label: "未點名", className: "text-ink-3" },
};

// 寬：課名｜週軸｜出席；窄：課名＋出席一行、週軸在下一行。
const LANE_COLS = "grid-cols-[minmax(0,1fr)_auto] @lg:grid-cols-[200px_minmax(0,1fr)_72px]";

const shortDate = (date: string | Date) => format(new Date(date), "M/d");

/**
 * 依課程：所有上過的課共用一條週軸，每門課一列、每週一格（出席／缺席／未點名／
 * 該週沒課）。點一列展開那門課的明細：出席數字、最長連續缺課、每一堂扣了哪張卡。
 */
const AttendanceByLesson = ({
  attendancesByLesson,
  now,
}: {
  attendancesByLesson: LessonAttendance[];
  now?: Date;
}) => {
  const nowTime = now?.getTime();
  const lessons = useMemo(() => sortLessons(attendancesByLesson), [attendancesByLesson]);
  // 依時間戳記 memo：axis 的 identity 穩定，每一列的週格才不會每次 render 都重算。
  const axis = useMemo(
    () => buildTimelineAxis(attendancesByLesson, nowTime === undefined ? new Date() : new Date(nowTime)),
    [attendancesByLesson, nowTime]
  );
  const [openId, setOpenId] = useState<number | null>(() => lessons[0]?.lessonId ?? null);

  return (
    <div className="@container flex flex-col gap-3">
      <Legend />
      <section className="border-b border-line">
        <div className={`grid ${LANE_COLS} gap-x-4 items-end pt-1 pb-2 border-b border-line`}>
          <span className="hidden @lg:block text-[13px] text-ink-3">課程（{lessons.length}）</span>
          <WeekAxis axis={axis} className="col-span-2 @lg:col-span-1" />
          <span className="hidden @lg:block text-[13px] text-ink-3 text-right">出席</span>
        </div>
        <ul className="m-0 p-0 list-none divide-y divide-line">
          {lessons.map((lesson) => (
            <LessonLane
              key={lesson.lessonId}
              lesson={lesson}
              axis={axis}
              open={openId === lesson.lessonId}
              onToggle={() => setOpenId((id) => (id === lesson.lessonId ? null : lesson.lessonId))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
};

const Legend = () => (
  <div className="flex items-center gap-x-3.5 gap-y-1 flex-wrap text-[13px] text-ink-3">
    {(["attended", "absent", "unchecked", "gap"] as const).map((cell) => (
      <span key={cell} className="inline-flex items-center gap-1.5">
        {cell === "gap" ? (
          <span className="block size-1 rounded-full bg-neutral-300" />
        ) : (
          <span className={`block box-border size-2.5 rounded-[3px] ${CELL_CLASS[cell]}`} />
        )}
        {CELL_TITLE[cell]}
      </span>
    ))}
  </div>
);

const weekGridStyle = (axis: TimelineAxis) => ({ gridTemplateColumns: `repeat(${axis.weeks}, minmax(0, 1fr))` });

const WeekAxis = ({ axis, className = "" }: { axis: TimelineAxis; className?: string }) => {
  // 月份標在該月第一週；「本週」優先，貼著它的月份標籤就讓掉，免得疊在一起。
  const labels = new Map<number, { text: string; today: boolean }>();
  for (const { index, month } of axis.months) {
    if (axis.todayIndex !== null && Math.abs(index - axis.todayIndex) <= 1 && index !== axis.todayIndex) continue;
    labels.set(index, { text: `${month + 1}月`, today: false });
  }
  if (axis.todayIndex !== null) labels.set(axis.todayIndex, { text: "本週", today: true });

  return (
    <div aria-hidden="true" className={`grid gap-0.5 @lg:gap-[3px] ${className}`} style={weekGridStyle(axis)}>
      {Array.from({ length: axis.weeks }, (_, index) => {
        const label = labels.get(index);
        return (
          <span
            key={index}
            className={`h-4 text-[10px] @lg:text-[11px] leading-4 whitespace-nowrap overflow-visible ${
              label?.today ? "font-semibold text-primary-800" : "text-ink-3"
            }`}
          >
            {label?.text}
          </span>
        );
      })}
    </div>
  );
};

const LessonLane = ({
  lesson,
  axis,
  open,
  onToggle,
}: {
  lesson: LessonAttendance;
  axis: TimelineAxis;
  open: boolean;
  onToggle: () => void;
}) => {
  const summary = useMemo(() => summarizeLesson(lesson), [lesson]);
  const cells = useMemo(() => lessonWeekCells(lesson, axis), [lesson, axis]);
  const onAxis = cells.some((cell) => cell !== "none");
  const slots = lesson.studentAttendances;
  const range = slots.length
    ? `${format(new Date(slots[0].periodStartTime), "yyyy/M/d")} – ${format(new Date(slots[slots.length - 1].periodStartTime), "yyyy/M/d")}`
    : "";
  const panelId = `lesson-lane-${lesson.lessonId}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full grid ${LANE_COLS} gap-x-4 gap-y-2 items-center py-3 text-left cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 ${
          open ? "" : "hover:bg-surface"
        }`}
      >
        <span className="min-w-0 flex flex-col gap-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-[15px] font-medium text-ink">{lesson.lessonName}</span>
            <ChevronDown
              aria-hidden="true"
              className={`size-4 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
          <span className="flex items-center gap-1.5">
            {lesson.danceStyle && <DanceBadge style={lesson.danceStyle} level={lesson.level} variant="full" />}
            <span className={`text-[13px] ${lesson.status === "inProgress" ? "font-semibold text-primary-800" : "text-ink-3"}`}>
              {lesson.status === "inProgress" ? "進行中" : "已結束"}
            </span>
          </span>
        </span>

        <span className="order-last col-span-2 @lg:order-none @lg:col-span-1 min-w-0">
          {onAxis ? (
            <span aria-hidden="true" className="grid gap-0.5 @lg:gap-[3px]" style={weekGridStyle(axis)}>
              {cells.map((cell, index) => (
                <span
                  key={index}
                  title={CELL_TITLE[cell] || undefined}
                  className={`block box-border h-4 @lg:h-[22px] rounded-[3px] ${CELL_CLASS[cell]} ${
                    index === axis.todayIndex && cell !== "none" ? "ring-1 ring-primary-900 ring-offset-1" : ""
                  }`}
                />
              ))}
            </span>
          ) : (
            <span className="block text-[13px] text-ink-3">{range}（早於時間軸）</span>
          )}
        </span>

        <span className="flex flex-col items-end leading-tight">
          <span className="text-[15px] font-semibold text-ink tabular-nums">
            {summary.attended}
            <span className="text-[13px] font-medium text-ink-3">/{summary.checked}</span>
          </span>
          <span className={`text-[13px] ${summary.absent ? "text-danger-700" : "text-primary-800"}`}>
            {summary.absent ? `缺 ${summary.absent}` : summary.checked ? "全勤" : "尚未點名"}
          </span>
        </span>
      </button>

      {open && <LessonDetail id={panelId} lesson={lesson} range={range} summary={summary} />}
    </li>
  );
};

const LessonDetail = ({
  id,
  lesson,
  range,
  summary,
}: {
  id: string;
  lesson: LessonAttendance;
  range: string;
  summary: ReturnType<typeof summarizeLesson>;
}) => {
  const streak = summary.longestAbsence;
  return (
    <div id={id} className="pt-1 pb-4 flex flex-col gap-2">
      <p className="m-0 text-[13px] tabular-nums text-ink-3">
        共 {lesson.totalPeriods} 堂 · 已點名 {summary.checked} 堂 · {range}
      </p>
      <p className="m-0 text-[15px] tabular-nums text-ink">
        出席 <b className="font-semibold">{summary.attended}</b> 堂 · 缺席{" "}
        <b className={`font-semibold ${summary.absent ? "text-danger-700" : ""}`}>{summary.absent}</b> 堂 · 出席率{" "}
        <b className="font-semibold">{summary.rate === null ? "—" : `${summary.rate}%`}</b>
      </p>
      {streak && (
        <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
          {shortDate(streak.from.periodStartTime)} – {shortDate(streak.to.periodStartTime)} 連續缺了 {streak.length} 堂
          （第 {streak.from.periodNumber}–{streak.to.periodNumber} 堂）
        </p>
      )}
      <ol className="m-0 mt-1 p-0 list-none @lg:columns-2 @lg:gap-6">
        {lesson.studentAttendances.map((slot) => {
          const at = new Date(slot.periodStartTime);
          const status = periodStatus(slot);
          const pill = STATUS_TEXT[status === "attended" && slot.pending ? "pending" : status];
          return (
            <li
              key={slot.periodId}
              className="break-inside-avoid grid grid-cols-[52px_72px_56px_minmax(0,1fr)] gap-2 items-center py-2 border-b border-line text-[13px]"
            >
              <span className="text-ink-3 tabular-nums">第 {slot.periodNumber} 堂</span>
              <span className="font-medium text-ink tabular-nums">
                {format(at, "M/d")} <span className="font-normal text-ink-3">週{WEEKDAYS[at.getDay()]}</span>
              </span>
              <span className={`justify-self-start ${pill.className}`}>{pill.label}</span>
              <span className="truncate text-ink-2">
                {slot.studentCard ? (
                  <>
                    {slot.studentCard.name}{" "}
                    <span className="text-ink-3 tabular-nums">{formatCardSerial(slot.studentCard.serialNumber)}</span>
                  </>
                ) : status === "attended" ? (
                  <span className="text-ink-3">未扣卡</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default AttendanceByLesson;
