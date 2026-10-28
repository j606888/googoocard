"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Circle, Coins, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toTaipeiDateKey, toTaipeiMonthKey } from "@/lib/taipei-date";
import { useGetFinanceCalendarQuery, type FinanceCalendar } from "@/store/slices/finance";
import { money } from "../format";
import { financeHref } from "../routes";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

type Day = FinanceCalendar["days"][number];

const STATUS: Record<NonNullable<Day["status"]>, { label: string; className: string; dot: string }> = {
  VERIFIED: { label: "已驗收", className: "bg-primary-100 text-primary-900", dot: "bg-primary-500" },
  PENDING: { label: "待驗收", className: "bg-warning-100 text-warning-950 font-medium", dot: "bg-warning-500" },
  NOT_TAKEN: { label: "還沒點名", className: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-400" },
  UPCOMING: { label: "還沒上", className: "border border-dashed border-neutral-300 text-neutral-600", dot: "border border-neutral-400" },
};

/**
 * 水庫行事曆：一天一格，標這天的課驗收到哪（還有一堂沒驗收就是待驗收），
 * 以及錢的事（大水庫的帳、繳回、發薪日）。點一天進當天的帳。
 */
export default function CalendarPage() {
  const thisMonth = toTaipeiMonthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading } = useGetFinanceCalendarQuery(month);
  const today = toTaipeiDateKey(new Date());
  const [y, m] = month.split("-").map(Number);

  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byKey = new Map((data?.days ?? []).map((d) => [d.dateKey, d]));
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">行事曆</h2>
        <Popover>
          <PopoverTrigger aria-label="說明" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-5" />
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">
            <p>課程從點名自動帶進來，在這裡看驗收到哪。一天有好幾堂，只要還有一堂沒驗收就顯示「待驗收」。</p>
            <p className="mt-2">也標了大水庫的帳、繳回和發薪日。點一天進當天的帳。</p>
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <Button variant="ghost" size="iconSm" aria-label="上個月" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums text-neutral-900">{y} 年 {m} 月</span>
        <Button variant="ghost" size="iconSm" aria-label="下個月" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
            {WEEKDAYS.map((w) => (
              <span key={w} className="px-1 text-center text-xs text-neutral-500 lg:px-2 lg:text-left lg:text-[13px]">{w}</span>
            ))}
            {cells.map((key, i) =>
              key ? <Cell key={key} dateKey={key} day={byKey.get(key)} today={key === today} /> : <span key={`e${i}`} />
            )}
          </div>
          <Legend />
        </>
      )}
    </div>
  );
}

function Cell({ dateKey, day, today }: { dateKey: string; day?: Day; today: boolean }) {
  const status = day?.status ? STATUS[day.status] : null;
  const money0 = day?.money ?? [];
  const label = [status?.label, day?.needsLook && "有一堂要看一下", ...money0.map((m) => m.label)].filter(Boolean).join("、");

  return (
    <Link
      href={financeHref.day(dateKey)}
      aria-label={`${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}${label ? `：${label}` : ""}`}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-xl border bg-white p-1 hover:border-primary-300 lg:min-h-28 lg:items-stretch lg:p-2",
        today ? "border-2 border-primary-500" : "border-neutral-200"
      )}
    >
      <span className={cn("text-[13px] font-semibold tabular-nums", today ? "text-primary-900" : "text-neutral-900")}>{Number(dateKey.slice(8))}</span>
      {/* 手機：小點；桌面：狀態字＋錢的事 */}
      <span className="flex gap-1 lg:hidden" aria-hidden="true">
        {status && <span className={cn("size-1.5 rounded-full", status.dot)} />}
        {money0.length > 0 && <span className="size-1.5 rounded-full bg-neutral-900" />}
      </span>
      <span className="hidden min-w-0 flex-col gap-1 lg:flex">
        {status && (
          <span className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs", status.className)}>
            {day?.status === "VERIFIED" && <Check className="size-3 shrink-0" />}
            {status.label}
          </span>
        )}
        {day?.needsLook && <span className="truncate px-0.5 text-[11px] text-warning-950">有一堂要看一下</span>}
        {money0.slice(0, 2).map((m, i) => (
          <span key={i} className="flex items-center gap-1 truncate rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs text-neutral-700">
            <Coins className="size-3 shrink-0" />
            {m.label}{m.amount !== null ? ` ${money(m.amount, { signed: true })}` : ""}
          </span>
        ))}
        {money0.length > 2 && <span className="px-0.5 text-[11px] text-neutral-500">+{money0.length - 2}</span>}
      </span>
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
      {Object.values(STATUS).map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", s.dot)} />
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-neutral-900" />
        錢的事
      </span>
      <span className="flex items-center gap-1.5 text-neutral-500">
        <Circle className="size-3" />
        點一天看那天的帳
      </span>
    </div>
  );
}
