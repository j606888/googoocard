"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { PeriodHeadcount } from "@/domains/attendance/rosterInsights";

// Headcount per session, as a column chart. It doubles as a period navigator:
// a column goes wherever PeriodSection's row for the same period goes, so this
// adds a faster entry point without introducing a second attendance flow.
const HeadcountChart = ({
  lessonId,
  data,
}: {
  lessonId: number;
  data: PeriodHeadcount[];
}) => {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-6 text-center">還沒有排任何時段</p>
    );
  }

  const rosterSize = data[0].rosterSize;
  const taken = data.filter((d) => d.taken);
  const average =
    taken.length > 0
      ? (taken.reduce((sum, d) => sum + d.attended, 0) / taken.length).toFixed(1)
      : null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-700">每堂到課人數</h3>
        {average && (
          <span className="text-xs text-neutral-500">
            平均 <span className="font-bold text-neutral-900">{average}</span> /{" "}
            {rosterSize} 人
          </span>
        )}
      </div>

      <div className="flex items-end gap-1.5 sm:gap-2">
        {data.map((column) => {
          const percent =
            column.rosterSize > 0
              ? Math.round((column.attended / column.rosterSize) * 100)
              : 0;
          return (
            <button
              key={column.periodId}
              type="button"
              onClick={() =>
                router.push(
                  column.taken
                    ? `/lessons/${lessonId}/periods/${column.periodId}/check-success`
                    : `/lessons/${lessonId}/periods/${column.periodId}/check`
                )
              }
              title={
                column.taken
                  ? `${format(new Date(column.startTime), "M/d")} · 出席 ${column.attended} / 缺席 ${column.absent}`
                  : `${format(new Date(column.startTime), "M/d")} · 尚未點名`
              }
              className="flex-1 min-w-0 max-w-[64px] flex flex-col items-center gap-1.5 cursor-pointer group"
            >
              <span
                className={`text-[11px] font-bold leading-none ${
                  column.taken ? "text-neutral-600" : "text-neutral-300"
                }`}
              >
                {column.taken ? column.attended : "–"}
              </span>
              {/* Ghost track = the roster. An un-taken period is a dashed empty
                  track, never a zero bar — "nobody came" and "not called yet"
                  must not look the same. */}
              <div
                className={`w-full h-20 rounded-md flex flex-col justify-end overflow-hidden transition-colors ${
                  column.taken
                    ? "bg-neutral-100 group-hover:bg-primary-50"
                    : "bg-warning-50 border border-dashed border-warning-400"
                }`}
              >
                {column.taken && (
                  <div
                    className="w-full rounded-t bg-primary-500 min-h-[2px] group-hover:bg-primary-600 transition-colors"
                    style={{ height: `${percent}%` }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] leading-none ${
                  column.taken ? "text-neutral-500" : "text-warning-700 font-semibold"
                }`}
              >
                {format(new Date(column.startTime), "M/d")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-neutral-100">
        <Legend className="bg-primary-500" label="到課人數" />
        <Legend className="bg-neutral-100 border border-neutral-200" label={`名單 ${rosterSize} 人`} />
        <Legend className="bg-warning-50 border border-dashed border-warning-400" label="尚未點名" />
      </div>
    </section>
  );
};

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
    <span className={`w-2.5 h-2.5 rounded-sm ${className}`} />
    {label}
  </span>
);

export default HeadcountChart;
