import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, CircleAlert } from "lucide-react";
import type { LessonAttendance } from "@/store/slices/students";
import DanceBadge from "../../StudentList/DanceBadge";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
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
  unchecked: "bg-white border border-dashed border-neutral-400",
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

const STATUS_PILL: Record<PeriodStatus | "pending", { label: string; tone: StatusTone; className?: string }> = {
  attended: { label: "出席", tone: "positive" },
  pending: { label: "待確認", tone: "warning" },
  absent: { label: "缺席", tone: "danger" },
  unchecked: { label: "未點名", tone: "outline", className: "text-neutral-500 border-dashed border-neutral-300" },
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
      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className={`grid ${LANE_COLS} gap-x-4 items-end px-4 pt-3 pb-2 border-b border-neutral-100`}>
          <span className="hidden @lg:block text-xs font-semibold text-neutral-500">課程（{lessons.length}）</span>
          <WeekAxis axis={axis} className="col-span-2 @lg:col-span-1" />
          <span className="hidden @lg:block text-xs font-semibold text-neutral-500 text-right">出席</span>
        </div>
        <ul className="m-0 p-0 list-none">
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
  <div className="flex items-center gap-x-3.5 gap-y-1 flex-wrap text-xs text-neutral-600">
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
              label?.today ? "font-bold text-primary-900" : "text-neutral-500"
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
    <li className="border-t first:border-t-0 border-neutral-100">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full grid ${LANE_COLS} gap-x-4 gap-y-2 items-center px-4 py-3 text-left cursor-pointer ${
          open ? "bg-primary-50" : "hover:bg-neutral-50"
        }`}
      >
        <span className="min-w-0 flex flex-col gap-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-sm font-semibold text-neutral-900">{lesson.lessonName}</span>
            <ChevronDown
              aria-hidden="true"
              className={`size-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
          <span className="flex items-center gap-1.5">
            {lesson.danceStyle && <DanceBadge style={lesson.danceStyle} level={lesson.level} variant="full" />}
            <span className={`text-[11px] ${lesson.status === "inProgress" ? "text-primary-900" : "text-neutral-500"}`}>
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
            <span className="block text-xs text-neutral-500">{range}（早於時間軸）</span>
          )}
        </span>

        <span className="flex flex-col items-end leading-tight">
          <span className="text-base font-bold text-neutral-900 tabular-nums">
            {summary.attended}
            <span className="text-xs font-medium text-neutral-500">/{summary.checked}</span>
          </span>
          <span className={`text-[11px] ${summary.absent ? "text-danger-700" : "text-primary-900"}`}>
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
    <div id={id} className="px-4 pt-1 pb-4 bg-primary-50/40 flex flex-col gap-3">
      <p className="m-0 text-xs text-neutral-500">
        共 {lesson.totalPeriods} 堂 · 已點名 {summary.checked} 堂 · {range}
      </p>
      <div className="grid grid-cols-3 gap-2 @lg:max-w-md">
        <Stat label="出席" value={summary.attended} className="bg-primary-50 text-primary-900" />
        <Stat label="缺席" value={summary.absent} className="bg-danger-50 text-danger-700" />
        <Stat label="出席率" value={summary.rate === null ? "—" : `${summary.rate}%`} className="bg-neutral-100 text-neutral-800" />
      </div>
      {streak && (
        <p className="m-0 flex items-center gap-2 rounded-xl bg-warning-50 text-warning-950 px-3 py-2 text-xs @lg:text-[13px]">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {shortDate(streak.from.periodStartTime)} – {shortDate(streak.to.periodStartTime)} 連續缺了 {streak.length} 堂
          （第 {streak.from.periodNumber}–{streak.to.periodNumber} 堂）
        </p>
      )}
      <ol className="m-0 p-0 list-none @lg:columns-2 @lg:gap-6">
        {lesson.studentAttendances.map((slot) => {
          const at = new Date(slot.periodStartTime);
          const status = periodStatus(slot);
          const pill = STATUS_PILL[status === "attended" && slot.pending ? "pending" : status];
          return (
            <li
              key={slot.periodId}
              className="break-inside-avoid grid grid-cols-[52px_72px_56px_minmax(0,1fr)] gap-2 items-center py-2 border-b border-neutral-100 text-[13px]"
            >
              <span className="text-neutral-500 tabular-nums">第 {slot.periodNumber} 堂</span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {format(at, "M/d")} <span className="font-normal text-xs text-neutral-500">週{WEEKDAYS[at.getDay()]}</span>
              </span>
              <StatusTag tone={pill.tone} className={`justify-self-start ${pill.className ?? ""}`}>
                {pill.label}
              </StatusTag>
              <span className="truncate text-xs text-neutral-600">
                {slot.studentCard ? (
                  <>
                    {slot.studentCard.name}{" "}
                    <span className="text-neutral-500 tabular-nums">{formatCardSerial(slot.studentCard.serialNumber)}</span>
                  </>
                ) : status === "attended" ? (
                  <span className="text-neutral-500">未扣卡</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const Stat = ({ label, value, className }: { label: string; value: number | string; className: string }) => (
  <div className={`rounded-xl px-3 py-2 ${className}`}>
    <div className="text-[11px]">{label}</div>
    <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
  </div>
);

export default AttendanceByLesson;
