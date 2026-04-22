"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import Navbar from "@/features/Navbar";
import Button from "@/components/Button";
import { useSearchParams } from "next/navigation";

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

interface DailyIncomeLesson {
  lessonId: number;
  lessonName: string;
  income: number;
  pendingStudents: string[];
}

interface DailyIncomeReport {
  date: string;
  availableDates: string[];
  totalIncome: number;
  lessons: DailyIncomeLesson[];
}

interface DailyDateResponse {
  availableDates: string[];
}

const formatDate = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayDateKey = formatDate(new Date().toISOString());

const IncomePage = () => {
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dailyReport, setDailyReport] = useState<DailyIncomeReport | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"daily" | "records">("daily");

  const fetchIncome = async (skip: number) => {
    const response = await fetch(`/api/income?skip=${skip}`);
    if (!response.ok) {
      throw new Error("Failed to fetch income records");
    }
    return (await response.json()) as IncomeResponse;
  };

  const fetchDailyDates = async () => {
    const response = await fetch("/api/income/daily");
    if (!response.ok) {
      throw new Error("Failed to fetch daily income dates");
    }
    return (await response.json()) as DailyDateResponse;
  };

  const fetchDailyReport = async (date: string) => {
    const response = await fetch(`/api/income/daily?date=${date}`);
    if (!response.ok) {
      throw new Error("Failed to fetch daily income report");
    }
    return (await response.json()) as DailyIncomeReport;
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
    const bootDaily = async () => {
      try {
        setIsDailyLoading(true);
        const dateResponse = await fetchDailyDates();
        setAvailableDates(dateResponse.availableDates);

        const queryDate = searchParams.get("date");
        const initialDate =
          queryDate ||
          (dateResponse.availableDates.includes(todayDateKey)
            ? todayDateKey
            : dateResponse.availableDates[0]);

        if (!initialDate) {
          setSelectedDate("");
          setDailyReport(null);
          return;
        }

        setSelectedDate(initialDate);
        const report = await fetchDailyReport(initialDate);
        setDailyReport(report);
      } finally {
        setIsDailyLoading(false);
      }
    };

    bootDaily();
  }, [searchParams]);

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setIsDailyLoading(true);
    try {
      const report = await fetchDailyReport(date);
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

            {!isDailyLoading && availableDates.length > 0 && (
              <div className="mb-3">
                <select
                  className="w-full border border-gray-200 rounded-sm p-2 text-sm"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                >
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
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
                <div className="rounded-sm bg-primary-50 p-3">
                  <p className="text-xs text-gray-600">{dailyReport.date}</p>
                  <p className="text-2xl font-bold text-primary-700">
                    ${Math.round(dailyReport.totalIncome)}
                  </p>
                  <p className="text-xs text-gray-600">當日總營收</p>
                </div>

                <div className="flex flex-col gap-2">
                  {dailyReport.lessons.map((lesson) => {
                    return (
                      <div
                        key={lesson.lessonId}
                        className="border border-gray-200 rounded-sm overflow-hidden"
                      >
                        <div
                          className="w-full px-3 py-2 flex items-center gap-2 bg-white"
                        >
                          <span className="font-medium text-left">{lesson.lessonName}</span>
                          <span className="ml-auto font-semibold text-green-600">
                            ${Math.round(lesson.income)}
                          </span>
                        </div>
                        {lesson.pendingStudents.length > 0 && (
                          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-red-600">
                              {lesson.pendingStudents.length} 位學生尚未付款
                            </p>
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
