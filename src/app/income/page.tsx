"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DollarSign } from "lucide-react";
import Navbar from "@/features/Navbar";
import Button from "@/components/Button";
import Link from "next/link";

interface IncomeRecord {
  id: number;
  createdAt: string;
  finalPrice: number;
  student: {
    name: string;
  };
  card: {
    name: string;
  };
}

interface IncomeResponse {
  records: IncomeRecord[];
  hasMore: boolean;
}

interface DailySummaryPeriod {
  lessonId: number;
  periodId: number;
  lessonName: string;
  attendanceCount: number;
  revenue: number;
  pendingStudents: string[];
}

interface DailySummaryResponse {
  selectedDate: string;
  totalRevenue: number;
  periods: DailySummaryPeriod[];
}

interface DailySummaryOptionsResponse {
  years: number[];
  dates: string[];
}

const formatDate = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateKey: string) => dateKey;

const IncomePage = () => {
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dailyReport, setDailyReport] = useState<DailySummaryResponse | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"daily" | "records">("daily");

  const fetchIncome = async (skip: number) => {
    const response = await fetch(`/api/income?skip=${skip}`);
    if (!response.ok) {
      throw new Error("Failed to fetch income records");
    }
    return (await response.json()) as IncomeResponse;
  };

  const fetchDailySummary = async (params: {
    date?: string;
  }) => {
    const search = new URLSearchParams();
    if (params.date) {
      search.set("date", params.date);
    }
    const response = await fetch(`/api/income/daily-summary?${search.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to fetch daily summary");
    }
    return (await response.json()) as DailySummaryResponse;
  };

  const fetchDailySummaryOptions = async () => {
    const response = await fetch("/api/income/daily-summary/options");
    if (!response.ok) {
      throw new Error("Failed to fetch daily summary options");
    }
    return (await response.json()) as DailySummaryOptionsResponse;
  };

  const loadInitial = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchIncome(0);
      setRecords(result.records);
      setHasMore(result.hasMore);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadMore = async () => {
    try {
      setIsLoadingMore(true);
      const result = await fetchIncome(records.length);
      setRecords((prev) => [...prev, ...result.records]);
      setHasMore(result.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const bootDailySummary = async () => {
      try {
        setIsDailyLoading(true);
        const [options, report] = await Promise.all([
          fetchDailySummaryOptions(),
          fetchDailySummary({}),
        ]);

        setYears(options.years);
        setAllDates(options.dates);
        setSelectedDate(report.selectedDate ?? "");
        setSelectedYear(
          report.selectedDate ? Number(report.selectedDate.slice(0, 4)) : options.years[0] ?? null
        );
        setDailyReport(report);
      } finally {
        setIsDailyLoading(false);
      }
    };

    bootDailySummary();
  }, []);

  const availableDates = useMemo(() => {
    if (!selectedYear) {
      return [];
    }
    return allDates.filter((date) => Number(date.slice(0, 4)) === selectedYear);
  }, [allDates, selectedYear]);

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    const yearDates = allDates.filter((date) => Number(date.slice(0, 4)) === year);
    const nextDate = yearDates[0] ?? "";
    setSelectedDate(nextDate);

    if (!nextDate) {
      setDailyReport({
        selectedDate: "",
        totalRevenue: 0,
        periods: [],
      });
      return;
    }

    setIsDailyLoading(true);
    try {
      const report = await fetchDailySummary({ date: nextDate });
      setDailyReport(report);
    } finally {
      setIsDailyLoading(false);
    }
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setIsDailyLoading(true);
    try {
      const report = await fetchDailySummary({ date });
      setDailyReport(report);
    } finally {
      setIsDailyLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-semibold">Income</h2>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1.5 rounded-sm text-sm cursor-pointer ${
              activeTab === "daily"
                ? "bg-primary-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setActiveTab("daily")}
          >
            課程營收
          </button>
          <button
            className={`px-3 py-1.5 rounded-sm text-sm cursor-pointer ${
              activeTab === "records"
                ? "bg-primary-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setActiveTab("records")}
          >
            課卡紀錄
          </button>
        </div>

        {activeTab === "daily" && (
          <div className="border border-gray-200 rounded-sm bg-white p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">單日營收報告</h3>
            </div>

            {!isDailyLoading && years.length > 0 && (
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
                      {formatDateLabel(date)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isDailyLoading && (
              <p className="text-sm text-gray-500">載入單日報告中...</p>
            )}

            {!isDailyLoading && !dailyReport && (
              <p className="text-sm text-gray-500">目前沒有可顯示的上課營收資料。</p>
            )}

            {!isDailyLoading && dailyReport && (
              <div className="flex flex-col gap-3">
                <div className="rounded-sm bg-primary-50 p-3 border border-primary-100">
                  <p className="text-xs text-gray-600">{dailyReport.selectedDate}</p>
                  <p className="text-2xl font-bold text-primary-700">
                    ${Math.round(dailyReport.totalRevenue)}
                  </p>
                  <p className="text-xs text-gray-600">當日總營收</p>
                </div>

                <div className="flex flex-col gap-2">
                  {dailyReport.periods.map((period) => {
                    return (
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "records" && (
          <>
            {isLoading && (
              <div className="text-sm text-gray-500 py-4">Loading income records...</div>
            )}

            {!isLoading && records.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm">
                <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col items-center justify-center">
                  <p className="text-lg font-bold">No income records yet</p>
                  <p className="text-sm text-gray-500 text-center">
                    Purchased cards will appear here.
                  </p>
                </div>
              </div>
            )}

            {!isLoading && records.length > 0 && (
              <>
                <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <div className="w-24 shrink-0 text-xs text-gray-500">
                          {formatDate(record.createdAt)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {record.student.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {record.card.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-base font-bold text-green-600">
                          ${record.finalPrice}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {hasMore && (
                  <div className="mt-4">
                    <Button
                      className="max-w-[180px]"
                      onClick={handleLoadMore}
                      isLoading={isLoadingMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? "Loading..." : "載入更多"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default IncomePage;
