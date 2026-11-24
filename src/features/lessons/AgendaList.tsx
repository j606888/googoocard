"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DanceStyleDot from "@/components/DanceStyleDot";
import { useGetLessonStudentsQuery } from "@/store/slices/lessons";
import { timeLeftLabel } from "./lessonSchedule";
import LateArrivalsSheet from "./LateArrivalsSheet";
import type { AgendaRow } from "./useLessonAgenda";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 「11/05（四）」。 */
const dateLabel = (date: Date) => `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）`;

const checkHref = ({ period }: AgendaRow) => `/lessons/${period.lesson.id}/periods/${period.id}/check`;

const teachersOf = ({ period }: AgendaRow) => {
  const teachers = period.lesson.teachers.map((t) => t.name).join("、");
  const assistants = (period.lesson.assistants ?? []).map((t) => t.name).join("、");
  return [teachers && `老師 ${teachers}`, assistants && `小幫手 ${assistants}`].filter(Boolean).join(" · ");
};

/** 數字寫成一句話（可用性測試：「5 人」看不出在算什麼）。 */
const countFor = ({ period }: AgendaRow) => {
  const arrived = period.attendeeIds.length;
  if (period.attendanceTakenAt) return `到 ${arrived} / ${period.lesson.studentCount} 位`;
  return arrived > 0 ? `已簽到 ${arrived} 位` : `${period.lesson.studentCount} 位學生`;
};

const overdueLine = ({ period }: AgendaRow) =>
  [
    `${dateLabel(new Date(period.startTime))} ${format(new Date(period.startTime), "HH:mm")}`,
    period.lesson.name,
    period.lesson.location?.name,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * 還沒點名的課：從「接下來」拆出來，放在頁首下面一條琥珀提醒，不限天數。
 * 只有一堂就直接「補點名」；多堂可以展開逐堂補。
 */
export const OverdueNotice = ({ rows }: { rows: AgendaRow[] }) => {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  const [oldest] = rows;
  const single = rows.length === 1;
  const summary = (
    <>
      <span className="min-w-0 flex-1 lg:flex lg:items-baseline lg:gap-3">
        <b className="block font-semibold lg:inline">{rows.length} 堂還沒點名</b>
        <span className="block truncate text-[13px] lg:inline lg:text-sm">
          {single ? overdueLine(oldest) : `最早一堂 ${overdueLine(oldest)}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
        {single ? "補點名" : open ? "收起" : "逐堂補點名"}
        {single ? (
          <ChevronRight aria-hidden="true" className="size-4" />
        ) : (
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </span>
    </>
  );
  const box = "flex min-h-13 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-warning-950";
  return (
    <section aria-label="還沒點名的課" className="rounded-xl bg-warning-100">
      {single ? (
        <Link href={checkHref(oldest)} className={`${box} hover:bg-warning-200/60`}>
          {summary}
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`${box} cursor-pointer hover:bg-warning-200/60`}
        >
          {summary}
        </button>
      )}
      {!single && open && (
        <ul className="divide-y divide-warning-200 px-4 pb-1.5">
          {rows.map((row) => (
            <li key={row.period.id} className="flex min-h-12 items-center gap-3 text-sm text-warning-950">
              <span className="min-w-0 flex-1 truncate">{overdueLine(row)}</span>
              <Link href={checkHref(row)} className="shrink-0 font-semibold hover:underline">
                補點名
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const AgendaItem = ({ row, now }: { row: AgendaRow; now: Date }) => {
  const { period, state } = row;
  const [lateOpen, setLateOpen] = useState(false);
  const start = new Date(period.startTime);
  const taken = Boolean(period.attendanceTakenAt);
  const days = differenceInCalendarDays(start, now);
  const isToday = days === 0;
  const people = teachersOf(row);
  const locationName = period.lesson.location?.name;
  const status =
    state === "inClass" ? `上課中 · ${timeLeftLabel(new Date(period.endTime), now)}` : countFor(row);

  // 名冊只有打開「補勾遲到」時才需要。
  const { data: roster } = useGetLessonStudentsQuery({ id: period.lesson.id }, { skip: !lateOpen });

  const action =
    state === "inClass" && taken ? (
      <Button variant="text" size="sm" onClick={() => setLateOpen(true)}>
        補勾遲到
      </Button>
    ) : taken ? (
      <span className="text-[13px] text-ink-3">已點名</span>
    ) : state === "inClass" || isToday ? (
      <Button asChild size="sm">
        <Link href={checkHref(row)}>點名</Link>
      </Button>
    ) : null;

  return (
    <li
      className={`relative flex min-h-16 items-center gap-3.5 py-2.5 lg:min-h-13 lg:gap-4 ${
        isToday ? "-mx-3 rounded-xl bg-primary-50 px-3 lg:-mx-4 lg:px-4" : "border-b border-line last:border-b-0"
      }`}
    >
      {/* 手機：日期方塊（大字日＋今天／週幾）。桌面：日期、時間各一欄。 */}
      <span className="w-11 shrink-0 text-center leading-tight lg:hidden">
        <b className={`block text-lg font-semibold tabular-nums ${isToday ? "text-primary-900" : "text-ink"}`}>
          {format(start, "d")}
        </b>
        <span className="text-xs text-ink-3">{isToday ? "今天" : days === 1 ? "明天" : `週${WEEKDAYS[start.getDay()]}`}</span>
      </span>
      <span className="hidden w-[104px] shrink-0 font-medium tabular-nums text-ink lg:block">
        {isToday ? "今天" : format(start, "M/d")}
        <span className="ml-1 text-[13px] font-normal text-ink-3">（{WEEKDAYS[start.getDay()]}）</span>
      </span>
      <span className="hidden w-14 shrink-0 tabular-nums text-ink-2 lg:block">{format(start, "HH:mm")}</span>

      <Link href={`/lessons/${period.lesson.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="flex items-center gap-2.5 font-medium text-ink">
          <DanceStyleDot style={period.lesson.danceStyle} />
          <span className="truncate">{period.lesson.name}</span>
          <span className="hidden truncate text-[13px] font-normal text-ink-3 lg:inline">
            {[locationName, people].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="block truncate text-[13px] tabular-nums text-ink-3 lg:hidden">
          {[format(start, "HH:mm"), locationName, status].filter(Boolean).join(" · ")}
        </span>
      </Link>

      <span
        className={`hidden w-[150px] shrink-0 text-right text-[13px] tabular-nums lg:block ${
          state === "inClass" ? "font-semibold text-primary-800" : "text-ink-2"
        }`}
      >
        {status}
      </span>
      {/* 疊在整列連結上面（z-10），才點得到。 */}
      <div className="relative z-10 flex shrink-0 justify-end lg:w-[84px]">{action}</div>
      {state === "inClass" && taken && (
        <LateArrivalsSheet open={lateOpen} onClose={() => setLateOpen(false)} period={period} roster={roster} />
      )}
    </li>
  );
};

/**
 * 「接下來 7 天」：上課中＋今天以後的課，一堂一列。還沒點名的不在這裡（見 `OverdueNotice`）。
 * 只有今天那列是淡綠底、實心「點名」；其他列整列點進課程頁。
 */
const AgendaList = ({
  rows,
  now,
  isLoading,
  hiddenCount,
  onShowAll,
}: {
  rows: AgendaRow[];
  now: Date;
  isLoading: boolean;
  /** 被「我的課／分部」篩掉的堂數——清單空的時候提示還有別的課。 */
  hiddenCount: number;
  onShowAll: () => void;
}) => (
  <section aria-labelledby="agenda-heading">
    <h2 id="agenda-heading" className="mb-2 text-[17px] font-semibold text-ink">
      接下來 7 天
    </h2>
    {isLoading ? (
      <div aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-13 w-full rounded-xl" />
        <Skeleton className="h-13 w-full rounded-xl opacity-60" />
      </div>
    ) : rows.length === 0 ? (
      <div className="flex items-center gap-3 py-3 text-sm text-ink-3">
        7 天內沒有要上的課
        {hiddenCount > 0 && (
          <Button variant="text" size="sm" onClick={onShowAll}>
            看全部 {hiddenCount} 堂
          </Button>
        )}
      </div>
    ) : (
      <ul>
        {rows.map((row) => (
          <AgendaItem key={row.period.id} row={row} now={now} />
        ))}
      </ul>
    )}
  </section>
);

export default AgendaList;
