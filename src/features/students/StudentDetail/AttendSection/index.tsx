import { useMemo, useState } from "react";
import { StudentWithDetail } from "@/store/slices/students";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import AttendanceByLesson from "./AttendanceByLesson";
import AttendanceByDate from "./AttendanceByDate";
import { WeeklyHeatGrid } from "./AttendInsights";
import { INSIGHT_WEEKS, countByStyle, flattenAttendances } from "./attendanceInsights";
import EmptyState from "@/components/EmptyState";
import { Band } from "../ProfilePanels";

type AttendView = "by_date" | "by_lesson";

/** Select 的值不能是 "all"／null，用 0 代表「所有舞種」（舞種 id 從 1 起）。 */
const ALL_STYLES = 0;

const VIEWS: SegmentedOption<AttendView>[] = [
  { label: "依日期", value: "by_date" },
  { label: "依課程", value: "by_lesson" },
];

/**
 * 出席分頁：依日期（預設，依月份分段）／依課程，上面一排舞種快篩。
 * `summary` 時在最上面放一張「近 13 週」摘要卡——側欄擺不下、收成分頁時用
 * （桌面有側欄時方格在側欄的 AttendInsights 裡）。
 */
const AttendSection = ({ student, summary = false }: { student: StudentWithDetail; summary?: boolean }) => {
  const { attendancesByLesson, attendancesByDate, overview } = student;
  const [view, setView] = useState<AttendView>("by_date");
  const [styleId, setStyleId] = useState<number | "all">("all");

  const all = useMemo(() => flattenAttendances(attendancesByDate), [attendancesByDate]);
  const styleCounts = useMemo(() => countByStyle(all), [all]);
  const filtered = useMemo(
    () => (styleId === "all" ? all : all.filter((attendance) => (attendance.danceStyle?.id ?? null) === styleId)),
    [all, styleId]
  );

  if (all.length === 0) {
    return <EmptyState kind="inline" title="還沒有上課紀錄" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {summary && (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="m-0 text-[17px] font-semibold text-ink">近 {INSIGHT_WEEKS} 週</h3>
              <span className="text-[13px] tabular-nums text-ink-3">累計 {overview.attendedCount} 堂</span>
            </div>
            <WeeklyHeatGrid attendances={all} />
          </section>
          <Band />
          <h3 className="m-0 text-[17px] font-semibold text-ink lg:mt-6">出席紀錄</h3>
        </>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SegmentedTabs ariaLabel="出席紀錄的顯示方式" options={VIEWS} value={view} onChange={setView} />
        {view === "by_date" && styleCounts.length > 1 && (
          <Select
            size="plain"
            aria-label="舞種"
            className="w-auto"
            value={styleId === "all" ? ALL_STYLES : styleId}
            onChange={(value) => setStyleId(value === ALL_STYLES ? "all" : value)}
            options={[
              { value: ALL_STYLES, label: "所有舞種", hint: `${all.length}` },
              ...styleCounts
                .filter((entry) => entry.style)
                .map(({ style, count }) => ({ value: style!.id, label: style!.name, hint: `${count}` })),
            ]}
          />
        )}
      </div>

      {view === "by_date" ? (
        filtered.length > 0 ? (
          <AttendanceByDate attendances={filtered} />
        ) : (
          <EmptyState kind="inline" title="這個舞種還沒有出席紀錄" />
        )
      ) : (
        <AttendanceByLesson attendancesByLesson={attendancesByLesson} />
      )}
    </div>
  );
};

export default AttendSection;
