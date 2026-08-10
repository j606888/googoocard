"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type {
  DailySummaryListResponse,
  DailySummaryResponse,
  DailyTotal,
} from "./types";
import { formatMoney, monthLabel } from "./format";

async function fetchDailySummaryList(): Promise<DailySummaryListResponse> {
  const res = await fetch("/api/income/daily-summary/list");
  if (!res.ok) throw new Error("Failed to fetch list");
  return res.json();
}

async function fetchDailySummary(date: string): Promise<DailySummaryResponse> {
  const res = await fetch(`/api/income/daily-summary?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch daily summary");
  return res.json();
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d} 週${weekday}`;
}

export default function DailyTab() {
  const [days, setDays] = useState<DailyTotal[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<Record<string, DailySummaryResponse>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDetail = async (date: string) => {
    if (detailCache[date]) return;
    setLoadingDetail(date);
    try {
      const detail = await fetchDailySummary(date);
      setDetailCache((prev) => ({ ...prev, [date]: detail }));
    } finally {
      setLoadingDetail(null);
    }
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
        loadDetail(date);
      }
      return next;
    });
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const { years, days } = await fetchDailySummaryList();
        setYears(years);
        setDays(days);
        setSelectedYear(years[0] ?? null);

        // 預設展開最新一天並載入其細節
        const latest = days[0];
        if (latest) {
          setExpandedDates(new Set([latest.date]));
          const detail = await fetchDailySummary(latest.date);
          setDetailCache({ [latest.date]: detail });
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const visibleDays = useMemo(
    () => days.filter((d) => Number(d.date.slice(0, 4)) === selectedYear),
    [days, selectedYear]
  );

  // 依月份分段(保持新→舊),並計算每月小計
  const monthGroups = useMemo(() => {
    const groups: { month: string; days: DailyTotal[]; total: number }[] = [];
    for (const day of visibleDays) {
      const month = monthLabel(day.date);
      const last = groups[groups.length - 1];
      if (last && last.month === month) {
        last.days.push(day);
        last.total += day.totalRevenue;
      } else {
        groups.push({ month, days: [day], total: day.totalRevenue });
      }
    }
    return groups;
  }, [visibleDays]);

  return (
    <div className="border border-neutral-200 rounded-sm bg-white p-3 mb-4">
      <h3 className="text-base font-semibold mb-3">每日營收</h3>

      {isLoading && <p className="text-sm text-neutral-500">載入中...</p>}

      {!isLoading && days.length === 0 && (
        <p className="text-sm text-neutral-500">目前沒有可顯示的上課營收資料。</p>
      )}

      {!isLoading && days.length > 0 && (
        <>
          {years.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer ${
                    selectedYear === year
                      ? "bg-primary-500 border-primary-500 text-white"
                      : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {monthGroups.map((group) => (
              <div key={group.month}>
                <div className="flex items-baseline justify-between mb-1 px-1">
                  <p className="text-xs text-neutral-400">{group.month}</p>
                  <p className="text-xs text-neutral-500">
                    本月 ${formatMoney(group.total)}
                  </p>
                </div>
                <div className="flex flex-col">
                  {group.days.map((day, idx) => {
                    const expanded = expandedDates.has(day.date);
                    const detail = detailCache[day.date];
                    const isLast = idx === group.days.length - 1;
                    return (
                      <div
                        key={day.date}
                        className={
                          expanded
                            ? "bg-primary-50 rounded-md ring-1 ring-primary-100 my-1 overflow-hidden"
                            : ""
                        }
                      >
                        <button
                          onClick={() => toggleDate(day.date)}
                          className={`w-full flex items-center gap-2 px-1 py-3 cursor-pointer transition-colors ${
                            expanded
                              ? "px-3 hover:bg-primary-100/40"
                              : `hover:bg-neutral-50 ${
                                  isLast ? "" : "border-b border-neutral-100"
                                }`
                          }`}
                        >
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              expanded
                                ? "rotate-180 text-primary-600"
                                : "text-neutral-400"
                            }`}
                          />
                          <span className="font-medium">{formatDayLabel(day.date)}</span>
                          <span className="ml-auto font-semibold text-primary-700">
                            ${formatMoney(day.totalRevenue)}
                          </span>
                        </button>

                        {expanded && (
                          <div className="px-3 pb-3">
                            {loadingDetail === day.date && !detail && (
                              <p className="text-sm text-neutral-500">載入細節中...</p>
                            )}
                            {detail && detail.periods.length === 0 && (
                              <p className="text-sm text-neutral-500">當日無課堂明細。</p>
                            )}
                            {detail && detail.periods.length > 0 && (
                              <div className="divide-y divide-primary-100">
                                {detail.periods.map((period) => (
                                  <div key={period.periodId} className="py-2.5">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{period.lessonName}</p>
                                      <p className="text-xs text-neutral-500">
                                        · 出席 {period.attendanceCount} 人
                                      </p>
                                      <p className="ml-auto font-semibold text-primary-700">
                                        ${formatMoney(period.revenue)}
                                      </p>
                                    </div>
                                    {period.pendingStudents.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-primary-100">
                                        <p className="text-xs font-semibold text-danger-600 mb-1">
                                          尚未扣卡：{period.pendingStudents.join("、")}
                                        </p>
                                        <Link
                                          href={`/lessons/${period.lessonId}/periods/${period.periodId}/check-success`}
                                          className="text-xs text-primary-700 underline"
                                        >
                                          回到該堂點名頁
                                        </Link>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
