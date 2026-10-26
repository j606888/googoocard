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
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import Drawer from "@/components/Drawer";
import { useSizeClass } from "@/hooks/useMediaQuery";
import type {
  CardMonthlyDetailResponse,
  CardMonthlyListResponse,
  CardMonthlyTotal,
  CardPurchase,
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
 * 月曆只標「哪天有收入」（小圓點）與今天，不再用深淺分營收高低。手機版
 * （compact）點日期改成彈出底部面板顯示當天明細——明細排在月曆下方時，
 * 點了要往下捲才看得到變化，像是沒反應。桌面版明細仍在右欄。
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
  const compact = useSizeClass() === "compact";
  const [type, setType] = useState<RevenueType>("session");
  const [sheetOpen, setSheetOpen] = useState(false);
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

  // 桌面：課卡再點同一天回到整月。手機面板裡沒有「整月」，直接換到那天。
  const handleSelectDate = async (date: string) => {
    if (type === "card") {
      setSelectedDate((current) => (!compact && current === date ? null : date));
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

  const openDay = (date: string) => {
    handleSelectDate(date);
    setSheetOpen(true);
  };
  const closeSheet = () => {
    setSheetOpen(false);
    // 課卡：關掉面板回到整月明細。
    if (type === "card") setSelectedDate(null);
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

  // 有收入的日子（舊→新），給面板的「前一天／後一天」用。
  const activeDates = useMemo(
    () => Object.keys(monthDayTotals).filter((d) => monthDayTotals[d] > 0).sort(),
    [monthDayTotals]
  );
  const selectedIndex = selectedDate ? activeDates.indexOf(selectedDate) : -1;
  const prevActiveDate = selectedIndex > 0 ? activeDates[selectedIndex - 1] : null;
  const nextActiveDate =
    selectedIndex >= 0 && selectedIndex < activeDates.length - 1
      ? activeDates[selectedIndex + 1]
      : null;
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
        <h2 className="text-2xl font-bold text-neutral-900">收入</h2>
        <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          onClick={handlePrevMonth}
          disabled={prevDisabled}
          aria-label="上個月"
        >
          <ChevronLeft />
        </Button>
        {monthKey ? (
          <span className="text-base font-semibold text-neutral-900 min-w-[128px] text-center">
            {monthLabel(monthKey)}
          </span>
        ) : (
          <div className="min-w-[128px] flex justify-center">
            <Skeleton className="h-5 w-24" />
          </div>
        )}
        <Button
          variant="secondary"
          size="icon"
          onClick={handleNextMonth}
          disabled={nextDisabled}
          aria-label={nextDisabled ? "下個月（尚未到）" : "下個月"}
        >
          <ChevronRight />
        </Button>
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
                ? "bg-warning-50 border-warning-300 hover:bg-warning-100"
                : "bg-primary-50 border-primary-100 hover:bg-primary-100"
          )}
        >
          {unpaidLoading ? (
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
          ) : unpaidCount > 0 ? (
            <CircleDollarSign className="w-5 h-5 text-warning-950 shrink-0" />
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
              <span className={cn("block text-xs", unpaidCount > 0 ? "text-warning-950" : "text-primary-900")}>
                未付款課卡
              </span>
              <span
                className={cn(
                  "block text-lg font-bold",
                  unpaidCount > 0 ? "text-warning-950" : "text-primary-900"
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
              <div key={w} className="text-center text-[11px] text-neutral-500 font-medium py-0.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {isLoading &&
              Array.from({ length: 35 }, (_, i) => (
                <Skeleton key={`skeleton-${i}`} className="h-11 rounded-lg" />
              ))}
            {cells.map((cell, i) => {
              if (!cell.date) return <div key={`blank-${i}`} />;
              const revenue = monthDayTotals[cell.date] ?? 0;
              const hasData = revenue > 0;
              // 手機的明細在面板裡，面板關著時月曆不留選取狀態。
              const selected = cell.date === selectedDate && (!compact || sheetOpen);
              const isToday = cell.date === today;
              return (
                <button
                  key={cell.date}
                  disabled={!hasData}
                  onClick={() => {
                    if (!cell.date) return;
                    if (compact) openDay(cell.date);
                    else handleSelectDate(cell.date);
                  }}
                  aria-pressed={selected}
                  aria-label={[
                    formatDayLabel(cell.date),
                    isToday && "今天",
                    hasData && `$${formatMoney(revenue)}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  className={cn(
                    "h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer disabled:cursor-default",
                    hasData && !selected && "hover:bg-neutral-50",
                    selected && "bg-primary-900"
                  )}
                >
                  <span
                    className={cn(
                      "size-7 rounded-full flex items-center justify-center text-[13px]",
                      hasData ? "font-semibold text-neutral-900" : "text-neutral-400",
                      isToday && "ring-[1.5px] ring-inset ring-primary-900 font-semibold text-primary-900",
                      selected && "text-white ring-white/70"
                    )}
                  >
                    {cell.day}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      hasData ? (selected ? "bg-white" : "bg-primary-700") : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 px-1 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-primary-700" />
              {type === "session" ? "有課程收入" : "有賣卡"}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-3.5 rounded-full ring-[1.5px] ring-inset ring-primary-900" />
              今天
            </span>
            <span className="ml-auto">
              {compact || type === "session" ? "點日期看當天明細" : "點日期只看當天"}
            </span>
          </div>
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

          {/* 明細（手機的當日課程明細在面板裡，這裡只剩載入／空月份） */}
          {!(compact && type === "session" && selectedDate) && (
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
                    <span className="text-lg font-bold text-primary-900">
                      ${formatMoney(monthDayTotals[selectedDate] ?? 0)}
                    </span>
                  </div>
                  <SessionPeriods
                    detail={sessionDetail}
                    loading={loadingSessionDate === selectedDate}
                  />
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
                      <Button
                        variant="link"
                        onClick={() => setSelectedDate(null)}
                        className="gap-0.5 text-xs"
                      >
                        <X className="size-3" />
                        看整月
                      </Button>
                    )}
                    {monthPurchases.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={downloadCsv} className="ml-auto">
                        <Download className="size-4" />
                        匯出 CSV
                      </Button>
                    )}
                  </div>
                  {loadingCardMonth === monthKey && monthPurchases.length === 0 && (
                    <DetailRowsSkeleton />
                  )}
                  {loadingCardMonth !== monthKey && shownPurchases.length === 0 && (
                    <EmptyState kind="inline" title="這段期間沒有購買紀錄。" />
                  )}
                  <PurchaseRows purchases={shownPurchases} showDate={!selectedDate} />
                </>
              )}

              {!isLoading && type === "session" && !selectedDate && (
                <EmptyState
                  kind="inline"
                  icon={<CalendarIcon />}
                  title={`本月尚無${typeLabel}收入`}
                  description="切換上方月份查看其他紀錄"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {compact && (
        <Drawer
          open={sheetOpen && !!selectedDate}
          onClose={closeSheet}
          onSubmit={closeSheet}
          title={selectedDate ? formatDayLabel(selectedDate) : ""}
          subtitle={`${typeLabel}收入`}
          submitText="關閉"
        >
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => prevActiveDate && handleSelectDate(prevActiveDate)}
              disabled={!prevActiveDate}
              aria-label="前一個有收入的日子"
            >
              <ChevronLeft />
            </Button>
            <p className="flex-1 text-center text-3xl font-bold text-primary-900">
              ${formatMoney(selectedDate ? monthDayTotals[selectedDate] ?? 0 : 0)}
            </p>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => nextActiveDate && handleSelectDate(nextActiveDate)}
              disabled={!nextActiveDate}
              aria-label="下一個有收入的日子"
            >
              <ChevronRight />
            </Button>
          </div>
          {type === "session" ? (
            <SessionPeriods detail={sessionDetail} loading={loadingSessionDate === selectedDate} />
          ) : (
            <PurchaseRows purchases={shownPurchases} showDate={false} />
          )}
        </Drawer>
      )}
    </div>
  );
}

/** 某天各堂課的收入；尚未扣卡的學生附上回點名頁的連結。 */
const SessionPeriods = ({
  detail,
  loading,
}: {
  detail: DailySummaryResponse | undefined;
  loading: boolean;
}) => {
  if (!detail) return loading ? <DetailRowsSkeleton /> : null;
  if (detail.periods.length === 0) return <EmptyState kind="inline" title="當日無課堂明細。" />;
  return (
    <div className="divide-y divide-neutral-100">
      {detail.periods.map((period) => (
        <div key={period.periodId} className="py-2.5">
          <div className="flex items-center gap-2">
            <p className="font-medium">{period.lessonName}</p>
            <p className="text-xs text-neutral-500">出席 {period.attendanceCount} 人</p>
            <p className="ml-auto font-semibold text-primary-900">
              ${formatMoney(period.revenue)}
            </p>
          </div>
          {period.pendingStudents.length > 0 && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <p className="text-xs font-semibold text-danger-700 mb-1">
                尚未扣卡:{period.pendingStudents.join("、")}
              </p>
              <Link
                href={`/lessons/${period.lessonId}/periods/${period.periodId}/check-success`}
                className="text-xs font-medium text-primary-700 underline underline-offset-4"
              >
                回到該堂點名頁
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/** 課卡購買列；整月檢視時每列前面帶日期。 */
const PurchaseRows = ({
  purchases,
  showDate,
}: {
  purchases: CardPurchase[];
  showDate: boolean;
}) => {
  if (purchases.length === 0) return null;
  return (
    <div className="divide-y divide-neutral-100">
      {purchases.map((purchase) => (
        <Link
          key={purchase.id}
          href={`/students/${purchase.studentId}`}
          className="flex items-center gap-3 py-2.5 hover:bg-neutral-50 -mx-2 px-2 rounded-lg"
        >
          {showDate && (
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
                purchase.isPaid ? "text-neutral-900" : "text-danger-700"
              )}
            >
              ${formatMoney(purchase.finalPrice)}
            </p>
            {!purchase.isPaid && <StatusTag tone="danger">未付款</StatusTag>}
          </div>
        </Link>
      ))}
    </div>
  );
};

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
        ? "border-primary-700 bg-white ring-[3px] ring-primary-100"
        : "border-neutral-200 bg-white hover:border-neutral-300"
    )}
  >
    <span className={cn("text-xs", active ? "text-primary-900 font-semibold" : "text-neutral-500")}>
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
