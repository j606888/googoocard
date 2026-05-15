"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  DailySummaryOptionsResponse,
  DailySummaryResponse,
} from "./types";

async function fetchDailySummaryOptions(): Promise<DailySummaryOptionsResponse> {
  const res = await fetch("/api/income/daily-summary/options");
  if (!res.ok) throw new Error("Failed to fetch options");
  return res.json();
}

async function fetchDailySummary(date: string): Promise<DailySummaryResponse> {
  const res = await fetch(`/api/income/daily-summary?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch daily summary");
  return res.json();
}

export default function DailyTab() {
  const [years, setYears] = useState<number[]>([]);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [report, setReport] = useState<DailySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const availableDates = useMemo(
    () => allDates.filter((d) => Number(d.slice(0, 4)) === selectedYear),
    [allDates, selectedYear]
  );

  const loadReport = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      setReport(await fetchDailySummary(date));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const options = await fetchDailySummaryOptions();
        setYears(options.years);
        setAllDates(options.dates);

        if (options.dates.length === 0) {
          setSelectedYear(options.years[0] ?? null);
          setReport({ selectedDate: "", totalRevenue: 0, periods: [] });
          return;
        }

        const initialDate = options.dates[0];
        setSelectedDate(initialDate);
        setSelectedYear(Number(initialDate.slice(0, 4)));
        setReport(await fetchDailySummary(initialDate));
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    const datesForYear = allDates.filter((d) => Number(d.slice(0, 4)) === year);
    const nextDate = datesForYear[0] ?? "";
    setSelectedDate(nextDate);
    if (!nextDate) {
      setReport({ selectedDate: "", totalRevenue: 0, periods: [] });
      return;
    }
    await loadReport(nextDate);
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    await loadReport(date);
  };

  return (
    <div className="border border-gray-200 rounded-sm bg-white p-3 mb-4">
      <h3 className="text-base font-semibold mb-3">單日營收報告</h3>

      {!isLoading && years.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select
            className="w-full border border-gray-200 rounded-sm p-2 text-sm"
            value={selectedYear ?? ""}
            onChange={(e) => handleYearChange(Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            className="w-full border border-gray-200 rounded-sm p-2 text-sm"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={availableDates.length === 0}
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">載入單日報告中...</p>}

      {!isLoading && !report && (
        <p className="text-sm text-gray-500">目前沒有可顯示的上課營收資料。</p>
      )}

      {!isLoading && report && (
        <div className="flex flex-col gap-3">
          <div className="rounded-sm bg-primary-50 p-3 border border-primary-100">
            <p className="text-xs text-gray-600">{report.selectedDate}</p>
            <p className="text-2xl font-bold text-primary-700">
              ${Math.round(report.totalRevenue)}
            </p>
            <p className="text-xs text-gray-600">當日總營收</p>
          </div>

          <div className="flex flex-col gap-2">
            {report.periods.map((period) => (
              <div
                key={period.periodId}
                className="border border-gray-200 rounded-sm bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium">{period.lessonName}</p>
                  <p className="text-xs text-gray-500">
                    出席 {period.attendanceCount} 人
                  </p>
                  <p className="ml-auto font-semibold text-green-600">
                    ${Math.round(period.revenue)}
                  </p>
                </div>
                {period.pendingStudents.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-red-600 mb-1">
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
        </div>
      )}
    </div>
  );
}
