"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type {
  CardMonthlyDetailResponse,
  CardMonthlyListResponse,
  CardMonthlyTotal,
} from "./types";
import { formatMoney, monthLabel } from "./format";
import MonthlyRevenueChart from "./MonthlyRevenueChart";

const CHART_MAX_MONTHS = 12;

async function fetchCardMonthlyList(): Promise<CardMonthlyListResponse> {
  const res = await fetch("/api/income/card-monthly");
  if (!res.ok) throw new Error("Failed to fetch card monthly list");
  return res.json();
}

async function fetchCardMonthlyDetail(
  month: string
): Promise<CardMonthlyDetailResponse> {
  const res = await fetch(`/api/income/card-monthly/${month}`);
  if (!res.ok) throw new Error("Failed to fetch card monthly detail");
  return res.json();
}

function formatDayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}

export default function CardMonthlyTab() {
  const [months, setMonths] = useState<CardMonthlyTotal[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<
    Record<string, CardMonthlyDetailResponse>
  >({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDetail = async (month: string) => {
    if (detailCache[month]) return;
    setLoadingDetail(month);
    try {
      const detail = await fetchCardMonthlyDetail(month);
      setDetailCache((prev) => ({ ...prev, [month]: detail }));
    } finally {
      setLoadingDetail(null);
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
        loadDetail(month);
      }
      return next;
    });
  };

  // 從圖表點選:一律展開(而非切換),避免點到已展開的月份反而收合
  const selectMonth = (month: string) => {
    setExpandedMonths((prev) => new Set(prev).add(month));
    loadDetail(month);
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const { years, months } = await fetchCardMonthlyList();
        setYears(years);
        setMonths(months);
        setSelectedYear(years[0] ?? null);

        // 預設展開最新一個月並載入其細節
        const latest = months[0];
        if (latest) {
          setExpandedMonths(new Set([latest.month]));
          const detail = await fetchCardMonthlyDetail(latest.month);
          setDetailCache({ [latest.month]: detail });
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const visibleMonths = useMemo(
    () => months.filter((m) => Number(m.month.slice(0, 4)) === selectedYear),
    [months, selectedYear]
  );

  // 圖表要由舊到新,且最多只畫最近 12 個月
  const chartMonths = useMemo(
    () => [...visibleMonths].reverse().slice(-CHART_MAX_MONTHS),
    [visibleMonths]
  );

  const yearTotal = useMemo(
    () => visibleMonths.reduce((sum, m) => sum + m.totalRevenue, 0),
    [visibleMonths]
  );

  // 圖上高亮:目前展開中且屬於當年的最新月份
  const highlightedMonth =
    visibleMonths.find((m) => expandedMonths.has(m.month))?.month ?? null;

  return (
    <div className="border border-neutral-200 rounded-sm bg-white p-3 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold">課卡營收</h3>
        {!isLoading && visibleMonths.length > 0 && (
          <p className="text-xs text-neutral-500">
            {selectedYear} 年共 ${formatMoney(yearTotal)}
          </p>
        )}
      </div>

      {isLoading && <p className="text-sm text-neutral-500">載入中...</p>}

      {!isLoading && months.length === 0 && (
        <p className="text-sm text-neutral-500">目前沒有課卡購買紀錄。</p>
      )}

      {!isLoading && months.length > 0 && (
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

          <MonthlyRevenueChart
            months={chartMonths}
            selectedMonth={highlightedMonth}
            onSelectMonth={selectMonth}
          />

          <div className="flex flex-col">
            {visibleMonths.map((monthTotal, idx) => {
              const expanded = expandedMonths.has(monthTotal.month);
              const detail = detailCache[monthTotal.month];
              const isLast = idx === visibleMonths.length - 1;
              return (
                <div
                  key={monthTotal.month}
                  className={
                    expanded
                      ? "bg-primary-50 rounded-md ring-1 ring-primary-100 my-1 overflow-hidden"
                      : ""
                  }
                >
                  <button
                    onClick={() => toggleMonth(monthTotal.month)}
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
                    <span className="font-medium">
                      {monthLabel(monthTotal.month)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      · {monthTotal.count} 張
                    </span>
                    <span className="ml-auto text-right">
                      <span className="block font-semibold text-primary-700">
                        ${formatMoney(monthTotal.totalRevenue)}
                      </span>
                      {monthTotal.unpaidTotal > 0 && (
                        <span className="block text-xs text-neutral-400">
                          未收 ${formatMoney(monthTotal.unpaidTotal)}
                        </span>
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3">
                      {loadingDetail === monthTotal.month && !detail && (
                        <p className="text-sm text-neutral-500">載入細節中...</p>
                      )}
                      {detail && detail.purchases.length === 0 && (
                        <p className="text-sm text-neutral-500">
                          當月無購買紀錄。
                        </p>
                      )}
                      {detail && detail.purchases.length > 0 && (
                        <div className="divide-y divide-primary-100">
                          {detail.purchases.map((purchase) => (
                            <Link
                              key={purchase.id}
                              href={`/students/${purchase.studentId}`}
                              className="flex items-center gap-3 py-2.5"
                            >
                              <div className="w-12 shrink-0 text-xs text-neutral-500">
                                {formatDayLabel(purchase.date)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-neutral-900 truncate">
                                  {purchase.studentName}
                                </p>
                                <p className="text-xs text-neutral-500 truncate">
                                  {purchase.cardName}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p
                                  className={`text-base font-bold ${
                                    purchase.isPaid
                                      ? "text-primary-700"
                                      : "text-danger-600"
                                  }`}
                                >
                                  ${formatMoney(purchase.finalPrice)}
                                </p>
                                {!purchase.isPaid && (
                                  <p className="text-xs text-danger-600">
                                    未付款
                                  </p>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
