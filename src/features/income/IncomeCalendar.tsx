"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CardMonthlyDetailResponse,
  CardMonthlyListResponse,
  CardMonthlyTotal,
  DailySummaryListResponse,
  DailySummaryResponse,
  DailyTotal,
} from "./types";
import { formatMoney, monthLabel } from "./format";
import {
  WEEKDAYS_SHORT,
  buildMonthGrid,
  formatDayLabel,
  monthKeyOf,
  revenueTier,
  shiftMonth,
  todayDateKey,
} from "./calendarUtils";

type RevenueType = "session" | "card";

async function fetchSessionList(): Promise<DailySummaryListResponse> {
  const res = await fetch("/api/income/daily-summary/list");
  if (!res.ok) throw new Error("Failed to fetch daily summary list");
  return res.json();
}

async function fetchSessionDay(date: string): Promise<DailySummaryResponse> {
  const res = await fetch(`/api/income/daily-summary?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch daily summary");
  return res.json();
}

async function fetchCardMonthList(): Promise<CardMonthlyListResponse> {
  const res = await fetch("/api/income/card-monthly");
  if (!res.ok) throw new Error("Failed to fetch card monthly list");
  return res.json();
}

async function fetchCardMonth(month: string): Promise<CardMonthlyDetailResponse> {
  const res = await fetch(`/api/income/card-monthly/${month}`);
  if (!res.ok) throw new Error("Failed to fetch card monthly detail");
  return res.json();
}

export default function IncomeCalendar() {
  const [type, setType] = useState<RevenueType>("session");
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [sessionDays, setSessionDays] = useState<DailyTotal[]>([]); // API 回傳為新→舊
  const [sessionDetailCache, setSessionDetailCache] = useState<
    Record<string, DailySummaryResponse>
  >({});
  const [loadingSessionDate, setLoadingSessionDate] = useState<string | null>(null);

  const [cardMonths, setCardMonths] = useState<CardMonthlyTotal[]>([]); // API 回傳為新→舊
  const [cardDetailCache, setCardDetailCache] = useState<
    Record<string, CardMonthlyDetailResponse>
  >({});
  const [loadingCardMonth, setLoadingCardMonth] = useState<string | null>(null);

  // 初始載入:兩種營收的總覽清單一起抓,決定預設月份/日期。
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const todayKey = todayDateKey();
      setToday(todayKey);
      try {
        const [sessionList, cardList] = await Promise.all([
          fetchSessionList(),
          fetchCardMonthList(),
        ]);
        setSessionDays(sessionList.days);
        setCardMonths(cardList.months);

        const initialMonth = monthKeyOf(sessionList.days[0]?.date ?? todayKey);
        setMonthKey(initialMonth);

        const latestDate =
          sessionList.days.find((d) => d.date.startsWith(initialMonth))?.date ?? null;
        setSelectedDate(latestDate);
        if (latestDate) {
          const detail = await fetchSessionDay(latestDate);
          setSessionDetailCache({ [latestDate]: detail });
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // 全部有資料的月份中最早/最晚的一個月,用來限制月份導覽的邊界。
  const earliestMonth = useMemo(() => {
    const candidates: string[] = [];
    if (sessionDays.length) candidates.push(monthKeyOf(sessionDays[sessionDays.length - 1].date));
    if (cardMonths.length) candidates.push(cardMonths[cardMonths.length - 1].month);
    if (!candidates.length) return today ? monthKeyOf(today) : null;
    return candidates.sort()[0];
  }, [sessionDays, cardMonths, today]);

  const todayMonth = today ? monthKeyOf(today) : null;
  const prevDisabled = !monthKey || !earliestMonth || monthKey <= earliestMonth;
  const nextDisabled = !monthKey || !todayMonth || monthKey >= todayMonth;

  // 切換月份或營收類型時,確保該月份的細節資料已載入,並挑選預設選取的日期。
  const goToMonth = async (newMonth: string, activeType: RevenueType) => {
    setMonthKey(newMonth);

    if (activeType === "session") {
      const latest = sessionDays.find((d) => d.date.startsWith(newMonth))?.date ?? null;
      setSelectedDate(latest);
      if (latest && !sessionDetailCache[latest]) {
        setLoadingSessionDate(latest);
        try {
          const detail = await fetchSessionDay(latest);
          setSessionDetailCache((prev) => ({ ...prev, [latest]: detail }));
        } finally {
          setLoadingSessionDate(null);
        }
      }
      return;
    }

    setLoadingCardMonth(newMonth);
    try {
      let detail = cardDetailCache[newMonth];
      if (!detail) {
        detail = await fetchCardMonth(newMonth);
        setCardDetailCache((prev) => ({ ...prev, [newMonth]: detail }));
      }
      const dates = [...new Set(detail.purchases.map((p) => p.date))].sort();
      setSelectedDate(dates[dates.length - 1] ?? null);
    } finally {
      setLoadingCardMonth(null);
    }
  };

  const handlePrevMonth = () => {
    if (!monthKey || prevDisabled) return;
    goToMonth(shiftMonth(monthKey, -1), type);
  };
  const handleNextMonth = () => {
    if (!monthKey || nextDisabled) return;
    goToMonth(shiftMonth(monthKey, 1), type);
  };

  const handleSetType = (newType: RevenueType) => {
    if (newType === type || !monthKey) {
      setType(newType);
      return;
    }
    setType(newType);
    goToMonth(monthKey, newType);
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    if (type === "session" && !sessionDetailCache[date]) {
      setLoadingSessionDate(date);
      try {
        const detail = await fetchSessionDay(date);
        setSessionDetailCache((prev) => ({ ...prev, [date]: detail }));
      } finally {
        setLoadingSessionDate(null);
      }
    }
  };

  // 當月每天的營收(課卡收入只計入已付款,與月列表的 totalRevenue 定義一致)。
  const monthDayTotals = useMemo(() => {
    const map: Record<string, number> = {};
    if (!monthKey) return map;
    if (type === "session") {
      sessionDays.forEach((d) => {
        if (d.date.startsWith(monthKey)) map[d.date] = d.totalRevenue;
      });
      return map;
    }
    const detail = cardDetailCache[monthKey];
    detail?.purchases.forEach((p) => {
      if (!p.isPaid) return;
      map[p.date] = (map[p.date] ?? 0) + p.finalPrice;
    });
    return map;
  }, [type, monthKey, sessionDays, cardDetailCache]);

  const maxRevenue = useMemo(
    () => Object.values(monthDayTotals).reduce((mx, v) => Math.max(mx, v), 0),
    [monthDayTotals]
  );
  const monthTotal = useMemo(
    () => Object.values(monthDayTotals).reduce((s, v) => s + v, 0),
    [monthDayTotals]
  );
  const cells = useMemo(() => (monthKey ? buildMonthGrid(monthKey) : []), [monthKey]);

  const sessionDetail = selectedDate ? sessionDetailCache[selectedDate] : undefined;
  const cardPurchasesForDay = useMemo(() => {
    if (type !== "card" || !monthKey || !selectedDate) return [];
    return (cardDetailCache[monthKey]?.purchases ?? []).filter((p) => p.date === selectedDate);
  }, [type, monthKey, selectedDate, cardDetailCache]);

  const typeLabel = type === "session" ? "課程" : "課卡";

  return (
    <div className="lg:max-w-3xl lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">
      {/* 月曆卡片 */}
      <div className="border border-neutral-200 rounded-sm bg-white p-3 lg:p-4">
        <div className="flex bg-neutral-100 rounded-lg p-1 gap-1 mb-4">
          <button
            onClick={() => handleSetType("session")}
            className={cn(
              "flex-1 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
              type === "session"
                ? "bg-primary-500 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            課程收入
          </button>
          <button
            onClick={() => handleSetType("card")}
            className={cn(
              "flex-1 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
              type === "card"
                ? "bg-primary-500 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            課卡收入
          </button>
        </div>

        <div className="flex items-center justify-center gap-1 mb-1">
          <button
            onClick={handlePrevMonth}
            disabled={prevDisabled}
            aria-label="上個月"
            className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:text-neutral-300 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-neutral-700 min-w-[92px] text-center">
            {monthKey ? monthLabel(monthKey) : ""}
          </span>
          <button
            onClick={handleNextMonth}
            disabled={nextDisabled}
            aria-label="下個月"
            className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:text-neutral-300 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-primary-700 leading-tight">
            ${formatMoney(monthTotal)}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">本月{typeLabel}收入</p>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS_SHORT.map((w) => (
            <div key={w} className="text-center text-[11px] text-neutral-400 font-medium py-0.5">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell.date) return <div key={`blank-${i}`} />;
            const revenue = monthDayTotals[cell.date] ?? 0;
            const hasData = revenue > 0;
            const tier = revenueTier(revenue, maxRevenue);
            const selected = cell.date === selectedDate;
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                disabled={!hasData}
                onClick={() => cell.date && handleSelectDate(cell.date)}
                className={cn(
                  "aspect-square rounded-md text-[13px] flex items-center justify-center transition-colors cursor-pointer disabled:cursor-default",
                  !hasData && "text-neutral-300",
                  !selected && hasData && tier === 1 && "bg-primary-50 text-primary-700 font-medium hover:bg-primary-100",
                  !selected && hasData && tier === 2 && "bg-primary-300 text-white font-medium hover:brightness-95",
                  !selected && hasData && tier === 3 && "bg-primary-500 text-white font-semibold hover:brightness-95",
                  selected && "bg-primary-700 text-white font-semibold shadow-sm",
                  isToday &&
                    (selected || tier >= 2
                      ? "ring-2 ring-inset ring-white/70"
                      : "ring-1 ring-inset ring-primary-300")
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* 明細卡片 */}
      <div className="border border-neutral-200 rounded-sm bg-white p-3 lg:p-4 mt-4 lg:mt-0">
        {isLoading && <p className="text-sm text-neutral-500">載入中...</p>}

        {!isLoading && selectedDate && (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm font-semibold">{formatDayLabel(selectedDate)}</span>
              <span className="text-lg font-bold text-primary-700">
                ${formatMoney(monthDayTotals[selectedDate] ?? 0)}
              </span>
            </div>

            {type === "session" && (
              <>
                {loadingSessionDate === selectedDate && !sessionDetail && (
                  <p className="text-sm text-neutral-500">載入細節中...</p>
                )}
                {sessionDetail && sessionDetail.periods.length === 0 && (
                  <p className="text-sm text-neutral-500">當日無課堂明細。</p>
                )}
                {sessionDetail && sessionDetail.periods.length > 0 && (
                  <div className="divide-y divide-neutral-100">
                    {sessionDetail.periods.map((period) => (
                      <div key={period.periodId} className="py-2.5">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{period.lessonName}</p>
                          <p className="text-xs text-neutral-400">
                            出席 {period.attendanceCount} 人
                          </p>
                          <p className="ml-auto font-semibold text-primary-700">
                            ${formatMoney(period.revenue)}
                          </p>
                        </div>
                        {period.pendingStudents.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-primary-100">
                            <p className="text-xs font-semibold text-danger-600 mb-1">
                              尚未扣卡:{period.pendingStudents.join("、")}
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
              </>
            )}

            {type === "card" && (
              <>
                {loadingCardMonth === monthKey && cardPurchasesForDay.length === 0 && (
                  <p className="text-sm text-neutral-500">載入細節中...</p>
                )}
                {loadingCardMonth !== monthKey && cardPurchasesForDay.length === 0 && (
                  <p className="text-sm text-neutral-500">當日無購買紀錄。</p>
                )}
                {cardPurchasesForDay.length > 0 && (
                  <div className="divide-y divide-neutral-100">
                    {cardPurchasesForDay.map((purchase) => (
                      <Link
                        key={purchase.id}
                        href={`/students/${purchase.studentId}`}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {purchase.studentName}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">{purchase.cardName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "text-base font-bold",
                              purchase.isPaid ? "text-primary-700" : "text-danger-600"
                            )}
                          >
                            ${formatMoney(purchase.finalPrice)}
                          </p>
                          {!purchase.isPaid && (
                            <p className="text-xs text-danger-600">未付款</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!isLoading && !selectedDate && (
          <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-primary-500" />
            </div>
            <p className="text-sm font-semibold">本月尚無{typeLabel}收入</p>
            <p className="text-xs text-neutral-400">切換上方月份查看其他紀錄</p>
          </div>
        )}
      </div>
    </div>
  );
}
