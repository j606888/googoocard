import { useMemo } from "react";
import { format, subWeeks } from "date-fns";
import type { StudentAttendance } from "@/store/slices/students";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import DanceBadge from "../../StudentList/DanceBadge";
import {
  INSIGHT_WEEKS,
  countByStyle,
  heatLevel,
  longestGapDays,
  weeklyAverageLabel,
  weeklyCounts,
} from "./attendanceInsights";

const HEAT = ["bg-neutral-100", "bg-primary-300", "bg-primary-600", "bg-primary-900"] as const;

/** 近 13 週每週一格：0 / 1 / 2 / 3+ 堂四個深淺。 */
export const WeeklyHeatGrid = ({ attendances, now = new Date() }: { attendances: StudentAttendance[]; now?: Date }) => {
  const counts = useMemo(() => weeklyCounts(attendances, now), [attendances, now]);
  const average = weeklyAverageLabel(counts);
  const gap = longestGapDays(attendances, now);
  const firstWeek = subWeeks(now, INSIGHT_WEEKS - 1);
  const description = counts.map((count, index) => `${index + 1}:${count}`).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`近 ${INSIGHT_WEEKS} 週每週出席堂數：${description}`}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${INSIGHT_WEEKS}, minmax(0, 1fr))` }}
      >
        {counts.map((count, index) => (
          <span
            key={index}
            title={`${count} 堂`}
            className={`block aspect-square rounded-[3px] ${HEAT[heatLevel(count)]}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-neutral-500">
        <span>{format(firstWeek, "M 月")}</span>
        <span>本週</span>
      </div>
      <p className="m-0 text-xs text-neutral-600">
        {average ? `${average}。` : `近 ${INSIGHT_WEEKS} 週沒有出席。`}
        {average && gap !== null && gap >= 14 && `最久 ${gap} 天沒來。`}
      </p>
    </div>
  );
};

/** 依舞種的長條：全部出席的分布，多的在前。 */
export const StyleBars = ({ attendances }: { attendances: StudentAttendance[] }) => {
  const counts = useMemo(() => countByStyle(attendances), [attendances]);
  const max = counts[0]?.count ?? 0;
  if (max === 0) return <p className="m-0 text-xs text-neutral-500">還沒有出席紀錄。</p>;
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2 text-[13px]">
      {counts.map(({ style, count }) => (
        <li key={style?.id ?? "none"} className="grid grid-cols-[minmax(64px,auto)_1fr_32px] gap-2 items-center">
          <span className="justify-self-start">
            {style ? <DanceBadge style={style} variant="full" /> : <span className="text-xs text-neutral-500">未分類</span>}
          </span>
          <span className="block h-2 rounded-full bg-neutral-100 overflow-hidden">
            <span
              className={`block h-full rounded-full ${style ? danceStyleMeta(style).dot : "bg-neutral-400"}`}
              style={{ width: `${Math.max(4, Math.round((count / max) * 100))}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-neutral-700">{count}</span>
        </li>
      ))}
    </ul>
  );
};
