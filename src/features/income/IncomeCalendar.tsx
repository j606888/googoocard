"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CardMonthlyDetailResponse,
  CardMonthlyListResponse,
  CardMonthlyTotal,
  DailySummaryListResponse,
  DailySummaryResponse,
  DailyTotal,
  SessionMonthlyResponse,
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
import {
  cardMonthTotal,
  groupPurchasesByCard,
  purchasesToCsv,
  sessionMonthTotal,
} from "./incomeInsights";

type RevenueType = "session" | "card";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

const fetchSessionList = () =>
  fetchJson<DailySummaryListResponse>("/api/income/daily-summary/list");
const fetchSessionDay = (date: string) =>
  fetchJson<DailySummaryResponse>(`/api/income/daily-summary?date=${date}`);
const fetchSessionMonth = (month: string) =>
  fetchJson<SessionMonthlyResponse>(`/api/income/session-monthly/${month}`);
const fetchCardMonthList = () =>
  fetchJson<CardMonthlyListResponse>("/api/income/card-monthly");
const fetchCardMonth = (month: string) =>
  fetchJson<CardMonthlyDetailResponse>(`/api/income/card-monthly/${month}`);

/**
 * 收入頁本體。上方兩張 KPI 卡同時是「課程／課卡」的切換；左邊月曆、
 * 右邊是該類型的拆分與明細：
 *   - 課程：依舞種拆分（session-monthly）＋ 點選日期看當日各堂
 *   - 課卡：依卡種拆分 ＋ 整月購買明細（點日期只看那天）＋ 匯出 CSV
 *
 * ⚠️ 資料仍是 fetch + useState，不是 RTK Query——搬遷記在 docs/roadmap.md。
 */
export default function IncomeCalendar({
  unpaidCount,
  unpaidLoading = false,
  onOpenUnpaid,
}: {
  unpaidCount: number;
  unpaidLoading?: boolean;
  onOpenUnpaid: () => void;
}) {
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
  const [sessionMonthCache, setSessionMonthCache] = useState<
    Record<string, SessionMonthlyResponse>
  >({});

  const [cardMonths, setCardMonths] = useState<CardMonthlyTotal[]>([]); // API 回傳為新→舊
  const [cardDetailCache, setCardDetailCache] = useState<
    Record<string, CardMonthlyDetailResponse>
  >({});
  const [loadingCardMonth, setLoadingCardMonth] = useState<string | null>(null);

  const loadSessionMonth = async (month: string) => {
    if (sessionMonthCache[month]) return;
    const detail = await fetchSessionMonth(month);
    setSessionMonthCache((prev) => ({ ...prev, [month]: detail }));
  };

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
        const [detail, monthly] = await Promise.all([
          latestDate ? fetchSessionDay(latestDate) : Promise.resolve(null),
          fetchSessionMonth(initialMonth),
        ]);
        if (latestDate && detail) setSessionDetailCache({ [latestDate]: detail });
        setSessionMonthCache({ [initialMonth]: monthly });
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
      const tasks: Promise<unknown>[] = [loadSessionMonth(newMonth)];
      if (latest && !sessionDetailCache[latest]) {
        setLoadingSessionDate(latest);
        tasks.push(
          fetchSessionDay(latest).then((detail) =>
            setSessionDetailCache((prev) => ({ ...prev, [latest]: detail }))
          )
        );
      }
      try {
        await Promise.all(tasks);
      } finally {
        setLoadingSessionDate(null);
      }
      return;
    }

    // 課卡：預設看整月明細，點日期才縮到那一天。
    setSelectedDate(null);
    if (cardDetailCache[newMonth]) return;
    setLoadingCardMonth(newMonth);
    try {
      const detail = await fetchCardMonth(newMonth);
      setCardDetailCache((prev) => ({ ...prev, [newMonth]: detail }));
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
    if (type === "card") {
      setSelectedDate((current) => (current === date ? null : date));
      return;
    }
    setSelectedDate(date);
    if (!sessionDetailCache[date]) {
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
  const cells = useMemo(() => (monthKey ? buildMonthGrid(monthKey) : []), [monthKey]);

  const prevMonth = monthKey ? shiftMonth(monthKey, -1) : null;
  const sessionTotal = monthKey ? sessionMonthTotal(sessionDays, monthKey) : 0;
  const cardTotal = monthKey ? cardMonthTotal(cardMonths, monthKey) : 0;
  const cardCount = cardMonths.find((m) => m.month === monthKey)?.count ?? 0;

  const sessionDetail = selectedDate ? sessionDetailCache[selectedDate] : undefined;
  const monthPurchases = useMemo(
    () => (monthKey ? cardDetailCache[monthKey]?.purchases ?? [] : []),
    [monthKey, cardDetailCache]
  );
  const shownPurchases = selectedDate
    ? monthPurchases.filter((p) => p.date === selectedDate)
    : monthPurchases;
  const cardBreakdown = useMemo(() => groupPurchasesByCard(monthPurchases), [monthPurchases]);
  const styleBreakdown = monthKey ? sessionMonthCache[monthKey]?.byDanceStyle ?? [] : [];

  const typeLabel = type === "session" ? "課程" : "課卡";

  const downloadCsv = () => {
    if (!monthKey) return;
    const blob = new Blob([purchasesToCsv(monthPurchases)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `課卡收入-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* 標題 + 月份切換 */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">收入</h2>
        <div className="flex items-center gap-1">
        <button
          onClick={handlePrevMonth}
          disabled={prevDisabled}
          aria-label="上個月"
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:text-neutral-300 disabled:bg-neutral-50 disabled:hover:bg-neutral-50 cursor-pointer disabled:cursor-default"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {monthKey ? (
          <span className="text-base font-semibold text-neutral-800 min-w-[128px] text-center">
            {monthLabel(monthKey)}
          </span>
        ) : (
          <div className="min-w-[128px] flex justify-center">
            <Skeleton className="h-5 w-24" />
          </div>
        )}
        <button
          onClick={handleNextMonth}
          disabled={nextDisabled}
          aria-label={nextDisabled ? "下個月（尚未到）" : "下個月"}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:text-neutral-300 disabled:bg-neutral-50 disabled:hover:bg-neutral-50 cursor-pointer disabled:cursor-default"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        </div>
      </div>

      {/* KPI：兩張營收卡同時是類型切換，第三張是未付款 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiButton
          active={type === "session"}
          onClick={() => handleSetType("session")}
          label="課程收入"
          loading={isLoading}
          value={sessionTotal}
          note={
            prevMonth
              ? `${shortMonth(prevMonth)}全月 $${formatMoney(sessionMonthTotal(sessionDays, prevMonth))}`
              : ""
          }
        />
        <KpiButton
          active={type === "card"}
          onClick={() => handleSetType("card")}
          label="課卡收入"
          loading={isLoading}
          value={cardTotal}
          note={`${cardCount} 張${
            prevMonth ? ` · ${shortMonth(prevMonth)}全月 $${formatMoney(cardMonthTotal(cardMonths, prevMonth))}` : ""
          }`}
        />
        <button
          type="button"
          onClick={onOpenUnpaid}
          aria-busy={unpaidLoading || undefined}
          className={cn(
            "col-span-2 lg:col-span-1 flex items-center gap-3 rounded-2xl border px-4 py-3 text-left cursor-pointer transition-colors",
            unpaidLoading
              ? "bg-white border-neutral-200 hover:bg-neutral-50"
              : unpaidCount > 0
                ? "bg-warning-50 border-warning-200 hover:bg-warning-100"
                : "bg-primary-50 border-primary-100 hover:bg-primary-100"
          )}
        >
          {unpaidLoading ? (
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
          ) : unpaidCount > 0 ? (
            <CircleDollarSign className="w-5 h-5 text-warning-700 shrink-0" />
          ) : (
            <CircleCheck className="w-5 h-5 text-primary-700 shrink-0" />
          )}
          {unpaidLoading ? (
            <div className="flex-1 min-w-0">
              <span className="block text-xs text-neutral-500">未付款課卡</span>
              <Skeleton className="h-6 w-24 mt-0.5" />
            </div>
          ) : (
            <span className="flex-1 min-w-0">
              <span className={cn("block text-xs", unpaidCount > 0 ? "text-warning-900" : "text-primary-700")}>
                未付款課卡
              </span>
              <span
                className={cn(
                  "block text-lg font-bold",
                  unpaidCount > 0 ? "text-warning-900" : "text-primary-700"
                )}
              >
                {unpaidCount > 0 ? `${unpaidCount} 張待收款` : "全部已收款"}
              </span>
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[360px_1fr] lg:gap-6 lg:items-start">
        {/* 月曆 */}
        <div className="border border-neutral-200 rounded-2xl bg-white p-3 lg:p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="text-center text-[11px] text-neutral-400 font-medium py-0.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {isLoading &&
              Array.from({ length: 35 }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} className="aspect-square" />
              ))}
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
                  aria-pressed={selected}
                  aria-label={
                    hasData
                      ? `${formatDayLabel(cell.date)} $${formatMoney(revenue)}`
                      : formatDayLabel(cell.date)
                  }
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
          <p className="text-[11px] text-neutral-400 mt-3">
            {type === "session" ? "點日期看當天每堂的收入" : "點日期只看當天，再點一次回到整月"}
          </p>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {/* 拆分 */}
          {type === "session" ? (
            styleBreakdown.length > 0 && (
              <Breakdown
                title="課程收入 · 依舞種"
                items={styleBreakdown.map((s) => ({
                  key: String(s.danceStyle.id),
                  label: s.danceStyle.name,
                  value: s.revenue,
                  barClass: danceStyleMeta(s.danceStyle).bg,
                }))}
              />
            )
          ) : (
            cardBreakdown.length > 0 && (
              <Breakdown
                title="課卡收入 · 依卡種"
                items={cardBreakdown.map((c) => ({
                  key: c.cardName,
                  label: `${c.cardName} × ${c.count}`,
                  value: c.revenue,
                  barClass: "bg-neutral-800",
                }))}
              />
            )
          )}

          {/* 明細 */}
          <div className="border border-neutral-200 rounded-2xl bg-white p-3 lg:p-4">
            {isLoading && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <DetailRowsSkeleton />
              </>
            )}

            {!isLoading && type === "session" && selectedDate && (
              <>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-sm font-semibold">{formatDayLabel(selectedDate)}</span>
                  <span className="text-lg font-bold text-primary-700">
                    ${formatMoney(monthDayTotals[selectedDate] ?? 0)}
                  </span>
                </div>
                {loadingSessionDate === selectedDate && !sessionDetail && <DetailRowsSkeleton />}
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

            {!isLoading && type === "card" && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">
                    {selectedDate ? formatDayLabel(selectedDate) : `${monthKey ? shortMonth(monthKey) : ""}課卡明細`}
                  </span>
                  {loadingCardMonth === monthKey && monthPurchases.length === 0 ? (
                    <Skeleton className="h-3.5 w-8" />
                  ) : (
                    <span className="text-xs text-neutral-500">{shownPurchases.length} 筆</span>
                  )}
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="flex items-center gap-0.5 text-xs text-primary-700 hover:underline cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      看整月
                    </button>
                  )}
                  {monthPurchases.length > 0 && (
                    <button
                      type="button"
                      onClick={downloadCsv}
                      className="ml-auto flex items-center gap-1 text-sm font-semibold text-primary-700 hover:bg-primary-50 rounded-lg px-2.5 py-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      匯出 CSV
                    </button>
                  )}
                </div>
                {loadingCardMonth === monthKey && monthPurchases.length === 0 && (
                  <DetailRowsSkeleton />
                )}
                {loadingCardMonth !== monthKey && shownPurchases.length === 0 && (
                  <p className="text-sm text-neutral-500 py-6 text-center">這段期間沒有購買紀錄。</p>
                )}
                {shownPurchases.length > 0 && (
                  <div className="divide-y divide-neutral-100">
                    {shownPurchases.map((purchase) => (
                      <Link
                        key={purchase.id}
                        href={`/students/${purchase.studentId}`}
                        className="flex items-center gap-3 py-2.5 hover:bg-neutral-50 -mx-2 px-2 rounded-lg"
                      >
                        {!selectedDate && (
                          <span className="w-20 shrink-0 text-xs text-neutral-500">
                            {formatDayLabel(purchase.date)}
                          </span>
                        )}
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
                              purchase.isPaid ? "text-neutral-900" : "text-danger-600"
                            )}
                          >
                            ${formatMoney(purchase.finalPrice)}
                          </p>
                          {!purchase.isPaid && <p className="text-xs text-danger-600">未付款</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {!isLoading && type === "session" && !selectedDate && (
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
      </div>
    </div>
  );
}

const shortMonth = (monthKey: string) => `${Number(monthKey.split("-")[1])} 月`;

const KpiButton = ({
  active,
  onClick,
  label,
  loading,
  value,
  note,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  loading: boolean;
  value: number;
  note: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "flex flex-col items-start rounded-2xl border px-4 py-3 text-left cursor-pointer transition-colors",
      active
        ? "border-primary-500 bg-white ring-2 ring-primary-100"
        : "border-neutral-200 bg-white hover:border-neutral-300"
    )}
  >
    <span className={cn("text-xs", active ? "text-primary-700 font-semibold" : "text-neutral-500")}>
      {label}
    </span>
    {loading ? (
      <>
        <Skeleton className="h-7 lg:h-8 w-24 my-0.5" />
        <Skeleton className="h-3 w-28 mt-1" />
      </>
    ) : (
      <>
        <span className="text-xl lg:text-2xl font-bold text-neutral-900">${formatMoney(value)}</span>
        {note && <span className="text-[11px] text-neutral-500 mt-0.5">{note}</span>}
      </>
    )}
  </button>
);

/** 明細列的骨架：名稱 · 次要資訊 · 金額，對齊載入後的 divide-y 清單。 */
const DetailRowsSkeleton = () => (
  <div className="divide-y divide-neutral-100" aria-busy="true" aria-label="載入細節中">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-2 py-2.5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-5 w-16 ml-auto" />
      </div>
    ))}
  </div>
);

const Breakdown = ({
  title,
  items,
}: {
  title: string;
  items: { key: string; label: string; value: number; barClass: string }[];
}) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <section className="border border-neutral-200 rounded-2xl bg-white p-3 lg:p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.key}>
            <div className="flex justify-between text-[13px]">
              <span className="truncate">{item.label}</span>
              <span className="font-semibold shrink-0">${formatMoney(item.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 mt-1 overflow-hidden">
              <div
                className={cn("h-2 rounded-full", item.barClass)}
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
