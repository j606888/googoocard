import { useMemo, useState } from "react";
import { StudentWithDetail } from "@/store/slices/students";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";
import FilterChip from "@/components/FilterChip";
import AttendanceByLesson from "./AttendanceByLesson";
import AttendanceByDate from "./AttendanceByDate";
import { WeeklyHeatGrid } from "./AttendInsights";
import { INSIGHT_WEEKS, countByStyle, flattenAttendances } from "./attendanceInsights";
import EmptyState from "@/components/EmptyState";

type AttendView = "by_date" | "by_lesson";

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
        <section className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-2">
          <h3 className="m-0 text-sm font-bold text-neutral-900 flex items-center justify-between">
            近 {INSIGHT_WEEKS} 週
            <span className="text-xs font-normal text-neutral-500">累計 {overview.attendedCount} 堂</span>
          </h3>
          <WeeklyHeatGrid attendances={all} />
        </section>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SegmentedTabs ariaLabel="出席紀錄的顯示方式" options={VIEWS} value={view} onChange={setView} />
        {view === "by_date" && styleCounts.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto max-w-full">
            <FilterChip size="sm" active={styleId === "all"} onClick={() => setStyleId("all")}>
              全部
            </FilterChip>
            {styleCounts
              .filter((entry) => entry.style)
              .map(({ style, count }) => (
                <FilterChip
                  key={style!.id}
                  size="sm"
                  active={styleId === style!.id}
                  count={count}
                  onClick={() => setStyleId(style!.id)}
                >
                  {style!.name}
                </FilterChip>
              ))}
          </div>
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
