"use client";

import { useRouter } from "next/navigation";
import { endOfDay, format } from "date-fns";
import type { PeriodHeadcount } from "@/domains/attendance/rosterInsights";
import EmptyState from "@/components/EmptyState";

// Headcount per session, as a column chart. It doubles as a period navigator:
// a column goes wherever PeriodSection's row for the same period goes, so this
// adds a faster entry point without introducing a second attendance flow.
const COMPACT_MAX_PERIODS = 4;

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
      <EmptyState kind="inline" title="還沒有排任何時段" />
    );
  }

  const rosterSize = data[0].rosterSize;
  const now = new Date();
  // An un-taken period is only "overdue" once its day has come.
  const isOverdue = (column: PeriodHeadcount) =>
    !column.taken && new Date(column.startTime).getTime() <= endOfDay(now).getTime();
  const taken = data.filter((d) => d.taken);
  const average =
    taken.length > 0
      ? (taken.reduce((sum, d) => sum + d.attended, 0) / taken.length).toFixed(1)
      : null;

  // A short course says little as a chart and pushes the roster below the fold:
  // one line per period instead.
  if (data.length <= COMPACT_MAX_PERIODS) {
    return (
      <section className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-sm font-bold text-neutral-700">到課</h3>
        {data.map((column) => (
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
            className={`text-xs rounded-full border px-2.5 py-1 cursor-pointer ${
              column.taken
                ? "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                : isOverdue(column)
                  ? "border-warning-300 text-warning-950 bg-warning-50"
                  : "border-dashed border-neutral-300 text-neutral-500"
            }`}
          >
            {format(new Date(column.startTime), "M/d")}{" "}
            <span className="font-semibold">
              {column.taken ? `${column.attended} 人` : "–"}
            </span>
          </button>
        ))}
        {average && (
          <span className="ml-auto text-xs text-neutral-500">
            平均 <span className="font-bold text-neutral-900">{average}</span> / {rosterSize} 人
          </span>
        )}
      </section>
    );
  }

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
                  column.taken ? "text-neutral-600" : "text-neutral-400"
                }`}
              >
                {column.taken ? column.attended : "–"}
              </span>
              {/* Ghost track = the roster. An un-taken period is a dashed empty
                  track, never a zero bar — "nobody came" and "not called yet"
                  must not look the same. */}
              <div
                className={`w-full h-20 rounded-sm flex flex-col justify-end overflow-hidden transition-colors ${
                  column.taken
                    ? "bg-neutral-100 group-hover:bg-primary-50"
                    : isOverdue(column)
                      ? "bg-warning-50 border border-dashed border-warning-300"
                      : "bg-white border border-dashed border-neutral-300"
                }`}
              >
                {column.taken && (
                  <div
                    className="w-full rounded-t-sm bg-primary-500 min-h-[2px] group-hover:bg-primary-600 transition-colors"
                    style={{ height: `${percent}%` }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] leading-none ${
                  column.taken || !isOverdue(column)
                    ? "text-neutral-500"
                    : "text-warning-950 font-semibold"
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
        <Legend className="bg-warning-50 border border-dashed border-warning-300" label="尚未點名" />
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
