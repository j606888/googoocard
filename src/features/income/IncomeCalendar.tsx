"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import DanceStyleDot from "@/components/DanceStyleDot";
import Drawer from "@/components/Drawer";
import Select from "@/components/Select";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useLocations } from "@/hooks/useLocations";
import type { DanceStyleSummary } from "@/lib/danceStyles";
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

/** 分部切換的值：所有分部，或某個分部的 id。 */
const ALL = "all" as const;
type LocationChoice = typeof ALL | number;

const EMPTY_DAYS: DailyTotal[] = [];
const EMPTY_MONTHS: CardMonthlyTotal[] = [];
const EMPTY_PURCHASES: CardPurchase[] = [];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

const withLocation = (url: string, loc: LocationChoice) =>
  loc === ALL ? url : `${url}${url.includes("?") ? "&" : "?"}locationId=${loc}`;

const fetchSessionList = (loc: LocationChoice) =>
  fetchJson<DailySummaryListResponse>(withLocation("/api/income/daily-summary/list", loc));
const fetchSessionDay = (date: string, loc: LocationChoice) =>
  fetchJson<DailySummaryResponse>(withLocation(`/api/income/daily-summary?date=${date}`, loc));
const fetchSessionMonth = (month: string, loc: LocationChoice) =>
  fetchJson<SessionMonthlyResponse>(withLocation(`/api/income/session-monthly/${month}`, loc));
const fetchCardMonthList = () =>
  fetchJson<CardMonthlyListResponse>("/api/income/card-monthly");
const fetchCardMonth = (month: string) =>
  fetchJson<CardMonthlyDetailResponse>(`/api/income/card-monthly/${month}`);

/** 手機上大區塊之間的 8px 淺灰帶（不是框）；桌面靠兩欄與留白。 */
const Band = () => <div aria-hidden="true" className="-mx-5 my-7 h-2 bg-band lg:hidden" />;

const HEADING = "text-[17px] font-semibold text-ink";
const NOTE = "text-[13px] tabular-nums text-ink-3";

const shortMonth = (monthKey: string) => `${Number(monthKey.split("-")[1])} 月`;

/**
 * 收入頁本體（去框線）。由上到下：月份切換 → 課程收入／課卡收入分頁 → 這個月的
 * 大數字與上個月對照 → 未付款那一句；下面左邊月曆、右邊是該類型的拆分與明細：
 *   - 課程：依舞種、依分部拆分（session-monthly）＋ 點選日期看當日各堂
 *   - 課卡：依卡種拆分 ＋ 整月購買明細（點日期只看那天）＋ 匯出 CSV
 *
 * 分部：教室有兩個以上分部時，頁首多一個分部切換。它只篩「課程收入」（課程的
 * 分部）；課卡各分部通用、系統也沒記在哪裡買的，所以課卡分頁永遠是整間教室。
 *
 * 月曆只標「哪天有收入」（小圓點）與今天。手機版（compact）點日期改成彈出底部
 * 面板顯示當天明細——明細排在月曆下方時，點了要往下捲才看得到變化，像是沒反應。
 *
 * ⚠️ 資料仍是 fetch + useState，不是 RTK Query——搬遷記在 docs/roadmap.md。
 * 每一份快取的 key 都帶分部（`loc|…`），換分部不會看到別的分部的數字。
 */
export default function IncomeCalendar({
  unpaidCount,
  unpaidTotal,
  unpaidLoading = false,
  onOpenUnpaid,
}: {
  unpaidCount: number;
  unpaidTotal: number;
  unpaidLoading?: boolean;
  onOpenUnpaid: () => void;
}) {
  const compact = useSizeClass() === "compact";
  const { locations } = useLocations();
  const multiLocation = locations.length >= 2;

  const [type, setType] = useState<RevenueType>("session");
  const [chosenLoc, setChosenLoc] = useState<LocationChoice>(ALL);
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  // 使用者點的日期；null = 課程用「該月最近一個有收入的日子」、課卡看整月。
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // 快取：key 一律帶分部。API 回傳的清單都是新→舊。
  const [sessionLists, setSessionLists] = useState<Record<string, DailyTotal[]>>({});
  const [sessionDayCache, setSessionDayCache] = useState<Record<string, DailySummaryResponse>>({});
  const [sessionMonthCache, setSessionMonthCache] = useState<Record<string, SessionMonthlyResponse>>({});
  const [cardMonthList, setCardMonthList] = useState<CardMonthlyTotal[] | null>(null);
  const [cardDetailCache, setCardDetailCache] = useState<Record<string, CardMonthlyDetailResponse>>({});
  const inflight = useRef(new Set<string>());

  /** 沒抓過、也不在路上才抓；失敗就記下來，不重試（重新整理即可）。 */
  const load = <T,>(key: string, cached: boolean, fetcher: () => Promise<T>, store: (value: T) => void) => {
    if (cached || inflight.current.has(key)) return;
    inflight.current.add(key);
    fetcher()
      .then(store)
      .catch(() => setFailed(true))
      .finally(() => inflight.current.delete(key));
  };

  // 選到的分部被封存（或教室只剩一個分部）就退回所有分部。
  const loc: LocationChoice =
    multiLocation && chosenLoc !== ALL && locations.some((l) => l.id === chosenLoc) ? chosenLoc : ALL;
  const locName = loc === ALL ? null : locations.find((l) => l.id === loc)?.name ?? null;

  const allSessionDays = sessionLists[ALL];
  const sessionDaysLoaded = sessionLists[loc];
  const sessionDays = sessionDaysLoaded ?? EMPTY_DAYS;
  const cardMonths = cardMonthList ?? EMPTY_MONTHS;

  // 預設月份：最近一個有課程收入的月份，沒有就是這個月。
  const monthKey =
    chosenMonth ?? (allSessionDays && today ? monthKeyOf(allSessionDays[0]?.date ?? today) : null);
  const isLoading = !monthKey || !sessionDaysLoaded || !cardMonthList;

  const latestSessionDate = monthKey
    ? sessionDays.find((d) => d.date.startsWith(monthKey))?.date ?? null
    : null;
  const pickedInMonth = pickedDate && monthKey && pickedDate.startsWith(monthKey) ? pickedDate : null;
  const selectedDate = type === "session" ? pickedInMonth ?? latestSessionDate : pickedInMonth;

  const dayKey = selectedDate ? `${loc}|${selectedDate}` : null;
  const sessionMonthKey = monthKey ? `${loc}|${monthKey}` : null;

  useEffect(() => {
    setToday(todayDateKey());
    load("card-months", false, fetchCardMonthList, (list) => setCardMonthList(list.months));
  }, []);

  useEffect(() => {
    load(`list|${loc}`, Boolean(sessionLists[loc]), () => fetchSessionList(loc), (list) =>
      setSessionLists((prev) => ({ ...prev, [loc]: list.days }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc]);

  useEffect(() => {
    if (type !== "session" || !monthKey || !sessionMonthKey) return;
    load(
      `month|${sessionMonthKey}`,
      Boolean(sessionMonthCache[sessionMonthKey]),
      () => fetchSessionMonth(monthKey, loc),
      (detail) => setSessionMonthCache((prev) => ({ ...prev, [sessionMonthKey]: detail }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, monthKey, loc]);

  useEffect(() => {
    if (type !== "session" || !selectedDate || !dayKey) return;
    load(
      `day|${dayKey}`,
      Boolean(sessionDayCache[dayKey]),
      () => fetchSessionDay(selectedDate, loc),
      (detail) => setSessionDayCache((prev) => ({ ...prev, [dayKey]: detail }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, selectedDate, loc]);

  useEffect(() => {
    if (type !== "card" || !monthKey) return;
    load(
      `card|${monthKey}`,
      Boolean(cardDetailCache[monthKey]),
      () => fetchCardMonth(monthKey),
      (detail) => setCardDetailCache((prev) => ({ ...prev, [monthKey]: detail }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, monthKey]);

  // 全部有資料的月份中最早的一個月（不分分部），用來限制月份導覽的邊界。
  const earliestMonth = useMemo(() => {
    const candidates: string[] = [];
    if (allSessionDays?.length) candidates.push(monthKeyOf(allSessionDays[allSessionDays.length - 1].date));
    if (cardMonths.length) candidates.push(cardMonths[cardMonths.length - 1].month);
    if (!candidates.length) return today ? monthKeyOf(today) : null;
    return candidates.sort()[0];
  }, [allSessionDays, cardMonths, today]);

  const todayMonth = today ? monthKeyOf(today) : null;
  const prevDisabled = !monthKey || !earliestMonth || monthKey <= earliestMonth;
  const nextDisabled = !monthKey || !todayMonth || monthKey >= todayMonth;

  const goToMonth = (delta: number) => {
    if (!monthKey) return;
    setChosenMonth(shiftMonth(monthKey, delta));
    setPickedDate(null);
  };
  const handleSetType = (newType: RevenueType) => {
    if (newType === type) return;
    setType(newType);
    setPickedDate(null);
  };
  const handleSetLocation = (newLoc: LocationChoice) => {
    setChosenLoc(newLoc);
    setPickedDate(null);
  };

  // 桌面：課卡再點同一天回到整月。手機面板裡沒有「整月」，直接換到那天。
  const handleSelectDate = (date: string) => {
    if (type === "card" && !compact && selectedDate === date) setPickedDate(null);
    else setPickedDate(date);
  };
  const openDay = (date: string) => {
    setPickedDate(date);
    setSheetOpen(true);
  };
  const closeSheet = () => {
    setSheetOpen(false);
    // 課卡：關掉面板回到整月明細。
    if (type === "card") setPickedDate(null);
  };

  const cardDetail = monthKey ? cardDetailCache[monthKey] : undefined;
  const monthPurchases = cardDetail?.purchases ?? EMPTY_PURCHASES;
  const cardDetailLoading = type === "card" && !cardDetail;

  // 當月每天的營收（課卡收入只計入已付款，與月列表的 totalRevenue 定義一致）。
  const monthDayTotals = useMemo(() => {
    const map: Record<string, number> = {};
    if (!monthKey) return map;
    if (type === "session") {
      sessionDays.forEach((d) => {
        if (d.date.startsWith(monthKey)) map[d.date] = d.totalRevenue;
      });
      return map;
    }
    monthPurchases.forEach((p) => {
      if (!p.isPaid) return;
      map[p.date] = (map[p.date] ?? 0) + p.finalPrice;
    });
    return map;
  }, [type, monthKey, sessionDays, monthPurchases]);

  // 有收入的日子（舊→新），給面板的「前一天／後一天」用。
  const activeDates = useMemo(
    () => Object.keys(monthDayTotals).filter((d) => monthDayTotals[d] > 0).sort(),
    [monthDayTotals]
  );
  const selectedIndex = selectedDate ? activeDates.indexOf(selectedDate) : -1;
  const prevActiveDate = selectedIndex > 0 ? activeDates[selectedIndex - 1] : null;
  const nextActiveDate =
    selectedIndex >= 0 && selectedIndex < activeDates.length - 1 ? activeDates[selectedIndex + 1] : null;
  const cells = useMemo(() => (monthKey ? buildMonthGrid(monthKey) : []), [monthKey]);

  const prevMonth = monthKey ? shiftMonth(monthKey, -1) : null;
  const sessionTotal = monthKey ? sessionMonthTotal(sessionDays, monthKey) : 0;
  const cardTotal = monthKey ? cardMonthTotal(cardMonths, monthKey) : 0;
  const cardCount = cardMonths.find((m) => m.month === monthKey)?.count ?? 0;
  const monthTotal = type === "session" ? sessionTotal : cardTotal;
  const comparison = !prevMonth
    ? ""
    : type === "session"
      ? `上個月全月 $${formatMoney(sessionMonthTotal(sessionDays, prevMonth))}`
      : `${cardCount} 張 · 上個月全月 $${formatMoney(cardMonthTotal(cardMonths, prevMonth))}`;

  const sessionDetail = dayKey ? sessionDayCache[dayKey] : undefined;
  const sessionMonth = sessionMonthKey ? sessionMonthCache[sessionMonthKey] : undefined;
  const shownPurchases = selectedDate
    ? monthPurchases.filter((p) => p.date === selectedDate)
    : monthPurchases;
  const shownPaidTotal = shownPurchases.reduce((sum, p) => (p.isPaid ? sum + p.finalPrice : sum), 0);
  const cardBreakdown = useMemo(() => groupPurchasesByCard(monthPurchases), [monthPurchases]);
  const styleBreakdown = sessionMonth?.byDanceStyle ?? [];
  // 依分部只在看「所有分部」時有意義；選了某個分部就只剩它自己一列。
  const locationBreakdown = multiLocation && loc === ALL ? sessionMonth?.byLocation ?? [] : [];

  const typeLabel = type === "session" ? "課程" : "課卡";
  const dayTotal = selectedDate ? monthDayTotals[selectedDate] ?? 0 : 0;
  // 手機的當日課程明細在面板裡，頁面上不重複一份。
  const showDetail = !(compact && type === "session" && selectedDate);

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
    <div className="flex flex-col">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold text-ink lg:text-[26px]">收入</h1>
        {multiLocation && (
          <Select<LocationChoice>
            size="plain"
            aria-label="分部"
            className="w-auto"
            value={loc}
            onChange={handleSetLocation}
            options={[
              { value: ALL, label: "所有分部" },
              ...locations.map((l) => ({ value: l.id as LocationChoice, label: l.name })),
            ]}
          />
        )}
      </div>

      {/* 月份切換 */}
      <div className="-ml-3 mt-1 flex items-center">
        <Button
          variant="text"
          size="icon"
          onClick={() => goToMonth(-1)}
          disabled={prevDisabled}
          aria-label="上個月"
        >
          <ChevronLeft />
        </Button>
        {monthKey ? (
          <span className="min-w-[7.5rem] text-center text-[17px] font-semibold tabular-nums text-ink">
            {monthLabel(monthKey)}
          </span>
        ) : (
          <span className="flex min-w-[7.5rem] justify-center">
            <Skeleton className="h-5 w-24" />
          </span>
        )}
        <Button
          variant="text"
          size="icon"
          onClick={() => goToMonth(1)}
          disabled={nextDisabled}
          aria-label={nextDisabled ? "下個月（尚未到）" : "下個月"}
        >
          <ChevronRight />
        </Button>
      </div>

      {/* 課程收入／課卡收入：分頁各帶自己這個月的金額 */}
      <div className="mt-2 border-b border-line">
        <SegmentedTabs
          variant="underline"
          ariaLabel="收入類型"
          value={type}
          onChange={handleSetType}
          className="-ml-3.5"
          options={[
            { value: "session", label: "課程收入", hint: isLoading ? undefined : `$${formatMoney(sessionTotal)}` },
            { value: "card", label: "課卡收入", hint: isLoading ? undefined : `$${formatMoney(cardTotal)}` },
          ]}
        />
      </div>

      <div className="lg:mt-7 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-x-16">
        <div className="min-w-0">
        {/* 這個月的數字 */}
        <div className="mt-5 lg:mt-0" aria-busy={isLoading && !failed ? true : undefined}>
          {failed && isLoading ? (
            <p role="alert" className="py-2 text-[15px] font-semibold text-warning-800">
              讀不到收入資料，請重新整理頁面再試一次。
            </p>
          ) : isLoading || !monthKey ? (
            <>
              <Skeleton className="h-10 w-40 rounded-lg" />
              <Skeleton className="mt-2.5 h-3.5 w-36" />
            </>
          ) : (
            <>
              <p className="text-[36px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-ink lg:text-[40px]">
                <span className="sr-only">
                  {shortMonth(monthKey)}
                  {type === "session" && locName ? ` ${locName} ` : ""}
                  {typeLabel}收入{" "}
                </span>
                ${formatMoney(monthTotal)}
              </p>
              <p className="mt-2 text-[13px] tabular-nums text-ink-3">{comparison}</p>
              {type === "card" && locName && (
                <p className="mt-1 text-[13px] text-ink-3">課卡各分部通用，這裡是整間教室的數字。</p>
              )}
            </>
          )}

          {/* 未付款：有錢沒收才是要處理的事 */}
          <div className="mt-2 flex min-h-11 items-center">
            {unpaidLoading ? (
              <Skeleton className="h-4 w-44" />
            ) : unpaidCount > 0 ? (
              <button
                type="button"
                onClick={onOpenUnpaid}
                className="-mx-3 flex min-h-11 cursor-pointer items-center gap-1 rounded-xl px-3 text-left text-[15px] font-semibold text-warning-800 outline-none hover:bg-warning-100 focus-visible:ring-[3px] focus-visible:ring-primary-300"
              >
                <span className="tabular-nums">
                  {unpaidCount} 張課卡還沒收款，共 ${formatMoney(unpaidTotal)}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              </button>
            ) : (
              <p className="text-[13px] text-ink-3">課卡全部已收款</p>
            )}
          </div>
        </div>

          <Band />

          {/* 月曆 */}
          <section className="lg:mt-5" aria-label={monthKey ? `${monthLabel(monthKey)}月曆` : "月曆"}>
            <div className="grid grid-cols-7">
              {WEEKDAYS_SHORT.map((w) => (
                <div key={w} className="pb-1 text-center text-[13px] text-ink-3">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {isLoading
                ? Array.from({ length: 35 }, (_, i) => (
                    <div key={`skeleton-${i}`} className="flex h-12 items-center justify-center">
                      <Skeleton className="size-8" />
                    </div>
                  ))
                : cells.map((cell, i) => {
                    const date = cell.date;
                    if (!date) return <div key={`blank-${i}`} />;
                    const revenue = monthDayTotals[date] ?? 0;
                    const hasData = revenue > 0;
                    // 手機的明細在面板裡，面板關著時月曆不留選取狀態。
                    const selected = date === selectedDate && (!compact || sheetOpen);
                    const isToday = date === today;
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!hasData}
                        onClick={() => (compact ? openDay(date) : handleSelectDate(date))}
                        aria-pressed={selected}
                        aria-label={[
                          formatDayLabel(date),
                          isToday && "今天",
                          hasData && `$${formatMoney(revenue)}`,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        className={cn(
                          "flex h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl outline-none transition-colors disabled:cursor-default focus-visible:ring-[3px] focus-visible:ring-primary-300",
                          hasData && !selected && "hover:bg-primary-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full text-sm tabular-nums",
                            hasData ? "font-semibold text-ink" : "text-ink-3",
                            isToday && "font-semibold text-primary-800 ring-[1.5px] ring-inset ring-primary-800",
                            selected && "bg-primary-900 text-white ring-0"
                          )}
                        >
                          {cell.day}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn("size-1 rounded-full", hasData ? "bg-primary-800" : "bg-transparent")}
                        />
                      </button>
                    );
                  })}
            </div>
            <p className="mt-2 text-[13px] text-ink-3">
              {type === "session" ? "圓點＝有課程收入" : "圓點＝有賣卡"} · 圓圈＝今天 ·{" "}
              {compact || type === "session" ? "點日期看當天明細" : "點日期只看當天"}
            </p>
          </section>
        </div>

        <div className="min-w-0">
          {isLoading && !failed && (
            <>
              <Band />
              <Skeleton className="h-5 w-32" />
              <DetailRowsSkeleton />
            </>
          )}

          {/* 拆分 */}
          {!isLoading && type === "session" && styleBreakdown.length > 0 && (
            <Breakdown
              id="income-by-style"
              title="課程收入 · 依舞種"
              items={styleBreakdown.map((s) => ({
                key: String(s.danceStyle.id),
                label: s.danceStyle.name,
                value: s.revenue,
                danceStyle: s.danceStyle,
              }))}
            />
          )}
          {!isLoading && type === "session" && locationBreakdown.length > 0 && (
            <Breakdown
              id="income-by-location"
              title="課程收入 · 依分部"
              items={locationBreakdown.map((entry) => {
                const id = entry.location?.id;
                // 已封存的分部不在切換選單裡，只列出、不能點。
                const selectable = id !== undefined && locations.some((l) => l.id === id);
                return {
                  key: String(id ?? "none"),
                  label: entry.location?.name ?? "未指定分部",
                  value: entry.revenue,
                  onSelect: selectable ? () => handleSetLocation(id) : undefined,
                  selectLabel: `只看${entry.location?.name ?? ""}`,
                };
              })}
            />
          )}
          {!isLoading && type === "card" && cardBreakdown.length > 0 && (
            <Breakdown
              id="income-by-card"
              title="課卡收入 · 依卡種"
              items={cardBreakdown.map((c) => ({
                key: c.cardName,
                label: c.cardName,
                meta: `${c.count} 張`,
                value: c.revenue,
              }))}
            />
          )}

          {/* 明細 */}
          {!isLoading && showDetail && (
            <>
              <Band />
              {type === "session" && selectedDate && (
                <section aria-labelledby="income-day">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 id="income-day" className={HEADING}>
                      {formatDayLabel(selectedDate)}
                    </h2>
                    <span className={NOTE}>共 ${formatMoney(dayTotal)}</span>
                  </div>
                  <SessionPeriods detail={sessionDetail} failed={failed} showLocation={multiLocation && loc === ALL} />
                </section>
              )}

              {type === "session" && !selectedDate && (
                <p className="py-3 text-[15px] text-ink-3">
                  {locName ? `${locName} ` : ""}這個月還沒有課程收入，換個月份看看。
                </p>
              )}

              {type === "card" && (
                <section aria-labelledby="income-purchases">
                  <div className="flex flex-wrap items-center gap-x-3">
                    <h2 id="income-purchases" className={HEADING}>
                      {selectedDate ? formatDayLabel(selectedDate) : `${monthKey ? shortMonth(monthKey) : ""}課卡明細`}
                    </h2>
                    {cardDetailLoading ? (
                      <Skeleton className="h-3.5 w-20" />
                    ) : (
                      shownPurchases.length > 0 && (
                        <span className={NOTE}>
                          {shownPurchases.length} 筆 · 已收 ${formatMoney(shownPaidTotal)}
                        </span>
                      )
                    )}
                    <span className="ml-auto flex items-center">
                      {selectedDate && (
                        <Button variant="text" size="sm" onClick={() => setPickedDate(null)}>
                          看整月
                        </Button>
                      )}
                      {monthPurchases.length > 0 && (
                        <Button variant="text" size="sm" onClick={downloadCsv} className="-mr-2 gap-1">
                          <Download className="size-4" />
                          匯出 CSV
                        </Button>
                      )}
                    </span>
                  </div>
                  {cardDetailLoading && !failed && <DetailRowsSkeleton />}
                  {cardDetailLoading && failed && (
                    <p role="alert" className="py-3 text-[15px] font-semibold text-warning-800">
                      讀不到這個月的課卡明細，請重新整理頁面。
                    </p>
                  )}
                  {!cardDetailLoading && shownPurchases.length === 0 && (
                    <p className="py-3 text-[15px] text-ink-3">這個月沒有人買課卡，換個月份看看。</p>
                  )}
                  <PurchaseRows purchases={shownPurchases} showDate={!selectedDate} />
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {compact && (
        <Drawer
          open={sheetOpen && !!selectedDate}
          onClose={closeSheet}
          onSubmit={closeSheet}
          title={selectedDate ? formatDayLabel(selectedDate) : ""}
          subtitle={`${type === "session" && locName ? `${locName} · ` : ""}${typeLabel}收入`}
          submitText="關閉"
        >
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="text"
              size="icon"
              onClick={() => prevActiveDate && setPickedDate(prevActiveDate)}
              disabled={!prevActiveDate}
              aria-label="前一個有收入的日子"
            >
              <ChevronLeft />
            </Button>
            <p className="flex-1 text-center text-[28px] font-semibold tabular-nums text-ink">
              ${formatMoney(dayTotal)}
            </p>
            <Button
              variant="text"
              size="icon"
              onClick={() => nextActiveDate && setPickedDate(nextActiveDate)}
              disabled={!nextActiveDate}
              aria-label="下一個有收入的日子"
            >
              <ChevronRight />
            </Button>
          </div>
          {type === "session" ? (
            <SessionPeriods detail={sessionDetail} failed={failed} showLocation={multiLocation && loc === ALL} />
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
  failed,
  showLocation,
}: {
  detail: DailySummaryResponse | undefined;
  failed: boolean;
  /** 看所有分部時，每堂課帶出它的分部。 */
  showLocation: boolean;
}) => {
  if (!detail) {
    return failed ? (
      <p role="alert" className="py-3 text-[15px] font-semibold text-warning-800">
        讀不到這天的明細，請重新整理頁面。
      </p>
    ) : (
      <DetailRowsSkeleton />
    );
  }
  if (detail.periods.length === 0) {
    return <p className="py-3 text-[15px] text-ink-3">這天沒有已點名的課。</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {detail.periods.map((period) => (
        <li key={period.periodId} className="py-2">
          <div className="flex min-h-10 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">{period.lessonName}</p>
              <p className="truncate text-[13px] tabular-nums text-ink-3">
                {[
                  `出席 ${period.attendanceCount} 人`,
                  period.sessionsPerAttendance > 1 && `每人扣 ${period.sessionsPerAttendance} 格`,
                  showLocation && period.location?.name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
              ${formatMoney(period.revenue)}
            </p>
          </div>
          {period.pendingStudents.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3">
              <p className="min-w-0 text-[13px] font-semibold text-warning-800">
                尚未扣卡：{period.pendingStudents.join("、")}
              </p>
              <Link
                href={`/lessons/${period.lessonId}/periods/${period.periodId}/check-success`}
                className="inline-flex min-h-11 items-center rounded-lg text-[13px] font-semibold text-primary-800 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary-300 lg:min-h-9"
              >
                回到該堂點名頁
              </Link>
            </div>
          )}
        </li>
      ))}
    </ul>
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
    <ul className="divide-y divide-line">
      {purchases.map((purchase) => (
        <li key={purchase.id}>
          <Link
            href={`/students/${purchase.studentId}`}
            className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 outline-none hover:bg-primary-50 focus-visible:ring-[3px] focus-visible:ring-primary-300"
          >
            {showDate && (
              <span className="w-[4.5rem] shrink-0 text-[13px] tabular-nums text-ink-3">
                {formatDayLabel(purchase.date)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-ink">{purchase.studentName}</span>
              <span className="block truncate text-[13px] text-ink-3">{purchase.cardName}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[15px] font-semibold tabular-nums text-ink">
                ${formatMoney(purchase.finalPrice)}
              </span>
              {!purchase.isPaid && (
                <span className="block text-[13px] font-semibold text-warning-800">未付款</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

/** 明細列的骨架：名稱 · 次要資訊 · 金額，對齊載入後的 divide-y 清單。 */
const DetailRowsSkeleton = () => (
  <div className="divide-y divide-line" aria-busy="true" aria-label="載入細節中">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex min-h-13 items-center gap-2 py-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
    ))}
  </div>
);

interface BreakdownItem {
  key: string;
  label: string;
  value: number;
  /** 名稱後面的次要資訊，例如「3 張」。 */
  meta?: string;
  danceStyle?: Pick<DanceStyleSummary, "name" | "color">;
  /** 有給就整列可點（依分部：只看這個分部）。 */
  onSelect?: () => void;
  selectLabel?: string;
}

/** 拆分：標題＋一列一項（名稱、金額、一條細長條）。長條只有一種顏色，比的是長度。 */
const Breakdown = ({ id, title, items }: { id: string; title: string; items: BreakdownItem[] }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <>
      <Band />
      <section aria-labelledby={id} className="lg:mb-9">
        <h2 id={id} className={HEADING}>
          {title}
        </h2>
        <ul className="mt-1">
          {items.map((item) => {
            const body: ReactNode = (
              <>
                <span className="flex items-center gap-2">
                  {item.danceStyle && <DanceStyleDot style={item.danceStyle} />}
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                    {item.label}
                    {item.meta && <span className="ml-2 text-[13px] tabular-nums text-ink-3">{item.meta}</span>}
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                    ${formatMoney(item.value)}
                  </span>
                  {item.onSelect && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
                </span>
                <span aria-hidden="true" className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-1 rounded-full bg-primary-700"
                    style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
                  />
                </span>
              </>
            );
            return (
              <li key={item.key} className="-mx-3">
                {item.onSelect ? (
                  <button
                    type="button"
                    onClick={item.onSelect}
                    aria-label={`${item.selectLabel ?? item.label}，$${formatMoney(item.value)}`}
                    className="block min-h-11 w-full cursor-pointer rounded-xl px-3 py-2 text-left outline-none hover:bg-primary-50 focus-visible:ring-[3px] focus-visible:ring-primary-300"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
};
