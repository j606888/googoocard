"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { endOfDay, format, isToday } from "date-fns";
import type { PeriodHeadcount } from "@/domains/attendance/rosterInsights";
import EmptyState from "@/components/EmptyState";

// Headcount per session, as a column chart. It doubles as a period navigator:
// a column goes wherever PeriodSection's row for the same period goes, so this
// adds a faster entry point without introducing a second attendance flow.
const COMPACT_MAX_PERIODS = 4;

const HeadcountChart = ({
  lessonId,
  data,
  variant = "expanded",
  attendanceRate,
}: {
  lessonId: number;
  data: PeriodHeadcount[];
  /** Shown next to 平均 on desktop (it used to be a pill in the header). */
  attendanceRate?: number;
  /** `compact` (phones): no chips row for short courses and no 平均 — the roster already says it. */
  variant?: "compact" | "expanded";
}) => {
  const compact = variant === "compact";
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
    if (compact) return null;
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

  if (!compact) {
    return (
      <ScrollingChart
        data={data}
        average={average === null ? null : Number(average)}
        attendanceRate={attendanceRate}
        isOverdue={isOverdue}
        onOpen={(column) =>
          router.push(
            column.taken
              ? `/lessons/${lessonId}/periods/${column.periodId}/check-success`
              : `/lessons/${lessonId}/periods/${column.periodId}/check`
          )
        }
      />
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-700">每堂到課人數</h3>
        {average && !compact && (
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

/** Track height of a desktop column, in px. */
const TRACK = 160;
/** Height of the date label under a column plus the gap above it, in px. */
const DATE_ROW = 20;
/** Room above the tallest bar for its count, in px. */
const LABEL_ROW = 16;

/**
 * Desktop: thin columns with an average line. Each column has a minimum width,
 * so a long-running class scrolls sideways instead of squeezing — and the
 * view starts at the newest end, where the teacher is.
 */
const ScrollingChart = ({
  data,
  average,
  attendanceRate,
  isOverdue,
  onOpen,
}: {
  data: PeriodHeadcount[];
  average: number | null;
  attendanceRate?: number;
  isOverdue: (column: PeriodHeadcount) => boolean;
  onOpen: (column: PeriodHeadcount) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rosterSize = data[0].rosterSize;
  // Scaled to the busiest session, not the roster: an ongoing class keeps
  // everyone who ever came on its roster, so roster-scaled bars sit flat.
  const peak = Math.max(1, ...data.filter((d) => d.taken).map((d) => d.attended));
  const scale = (n: number) => Math.round((n / peak) * TRACK);

  // Start scrolled to the newest periods. Keyed on the count so adding a
  // period scrolls to it, while a refetch with the same periods leaves the
  // teacher's position alone.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data.length]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-5 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-bold text-neutral-900">每堂到課人數</h2>
        {average !== null && (
          <span className="text-[13px] text-neutral-600">
            平均 <span className="font-bold text-neutral-900">{average.toFixed(1)}</span> / {rosterSize} 人
            {attendanceRate !== undefined && (
              <>
                {" "}· 出席率 <span className="font-bold text-neutral-900">{attendanceRate}%</span>
              </>
            )}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="relative flex w-max min-w-full items-end gap-1.5">
          {average !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-neutral-400"
              style={{ bottom: DATE_ROW + scale(average) }}
            />
          )}
          {data.map((column) => {
            const label = format(new Date(column.startTime), "M/d");
            const today = isToday(new Date(column.startTime));
            const aboveAverage = average !== null && column.attended >= average;
            return (
              <button
                key={column.periodId}
                type="button"
                onClick={() => onOpen(column)}
                title={column.taken ? `${label}：${column.attended} 人` : `${label}：尚未點名`}
                className="group flex min-w-[34px] flex-[1_0_34px] cursor-pointer flex-col items-center gap-1"
              >
                <div
                  className="flex w-full flex-col items-center justify-end gap-1"
                  style={{ height: TRACK + LABEL_ROW }}
                >
                  {column.taken && (
                    <span className="text-[11px] leading-none tabular-nums text-neutral-500">
                      {column.attended}
                    </span>
                  )}
                  <div
                    className={`w-[22px] shrink-0 rounded-t-[4px] transition-colors ${
                      column.taken
                        ? aboveAverage
                          ? "bg-primary-500 group-hover:bg-primary-600"
                          : "bg-primary-300 group-hover:bg-primary-400"
                        : isOverdue(column)
                          ? "border border-dashed border-warning-300 bg-warning-50"
                          : "border border-dashed border-neutral-300"
                    }`}
                    style={{ height: column.taken ? Math.max(scale(column.attended), 2) : TRACK }}
                  />
                </div>
                <span
                  className={`h-4 text-[11px] leading-4 whitespace-nowrap ${
                    today
                      ? "font-bold text-warning-900"
                      : isOverdue(column)
                        ? "font-semibold text-warning-900"
                        : "text-neutral-500"
                  }`}
                >
                  {today ? "今天" : label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {average !== null && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="w-3.5 border-t-[1.5px] border-dashed border-neutral-400" />
          平均線
        </div>
      )}
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
