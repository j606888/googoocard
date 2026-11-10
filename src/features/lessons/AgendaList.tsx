"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { useGetLessonStudentsQuery } from "@/store/slices/lessons";
import { timeLeftLabel } from "./lessonSchedule";
import LateArrivalsSheet from "./LateArrivalsSheet";
import type { AgendaRow } from "./useLessonAgenda";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 補零、等寬：「11/05（四）」。一整欄的日期和星期才會對齊。 */
const dateLabel = (date: Date) => `${format(date, "MM/dd")}（${WEEKDAYS[date.getDay()]}）`;

const statusFor = ({ period, state }: AgendaRow, now: Date) => {
  if (state === "overdue") return { text: "還沒點名", className: "text-warning-900" };
  if (state === "inClass")
    return {
      text: `上課中 · ${timeLeftLabel(new Date(period.endTime), now)}`,
      className: "text-primary-700",
    };
  const days = differenceInCalendarDays(new Date(period.startTime), now);
  return {
    text: days === 0 ? "今天" : days === 1 ? "明天" : "",
    className: "text-neutral-600",
  };
};

const peopleFor = ({ period }: AgendaRow) => {
  const teachers = period.lesson.teachers.map((t) => t.name).join("、");
  const assistants = (period.lesson.assistants ?? []).map((t) => t.name).join("、");
  return [teachers, assistants && `小幫手 ${assistants}`].filter(Boolean).join(" · ");
};

const countFor = ({ period }: AgendaRow) => {
  const arrived = period.attendeeIds.length;
  if (period.attendanceTakenAt) return `到 ${arrived} / ${period.lesson.studentCount} 人`;
  return arrived > 0 ? `已簽到 ${arrived} 人` : `${period.lesson.studentCount} 人`;
};

const AgendaItem = ({ row, now }: { row: AgendaRow; now: Date }) => {
  const { period, state } = row;
  const [lateOpen, setLateOpen] = useState(false);
  const start = new Date(period.startTime);
  const taken = Boolean(period.attendanceTakenAt);
  const isToday = differenceInCalendarDays(start, now) === 0;
  const checkHref = `/lessons/${period.lesson.id}/periods/${period.id}/check`;
  const status = statusFor(row, now);
  const people = peopleFor(row);
  const count = countFor(row);

  // 名冊只有打開「補勾遲到」時才需要。
  const { data: roster } = useGetLessonStudentsQuery(
    { id: period.lesson.id },
    { skip: !lateOpen }
  );

  const action =
    state === "inClass" && taken ? (
      <Button variant="secondary" size="sm" onClick={() => setLateOpen(true)}>
        補勾遲到
      </Button>
    ) : taken ? (
      <span className="text-[13px] text-neutral-600">已點名</span>
    ) : (
      <Button asChild size="sm" variant={state !== "upcoming" || isToday ? "primary" : "secondary"}>
        <Link href={checkHref}>點名</Link>
      </Button>
    );

  return (
    <li
      className={`flex min-h-16 items-center gap-3 px-4 py-2 lg:min-h-14 ${
        state === "overdue" ? "bg-warning-50" : ""
      }`}
    >
      <div className="w-[92px] shrink-0 tabular-nums lg:flex lg:w-[168px] lg:items-baseline lg:gap-3">
        <p className="text-sm font-semibold text-neutral-900">{dateLabel(start)}</p>
        <p className="text-[13px] text-neutral-600 lg:text-sm lg:font-semibold lg:text-neutral-900">
          {format(start, "HH:mm")}
        </p>
      </div>
      <Link href={`/lessons/${period.lesson.id}`} className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-neutral-900">
          {period.lesson.name}
          {people && (
            <span className="ml-2 hidden text-[13px] font-normal text-neutral-600 lg:inline">
              {people}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-neutral-600 lg:hidden">
          {status.text && <span className={`font-semibold ${status.className}`}>{status.text} · </span>}
          {[people, count].filter(Boolean).join(" · ")}
        </p>
      </Link>
      <span className={`hidden w-[150px] shrink-0 text-[13px] font-semibold lg:block ${status.className}`}>
        {status.text}
      </span>
      <span className="hidden w-[92px] shrink-0 text-right text-[13px] tabular-nums text-neutral-600 lg:block">
        {count}
      </span>
      <div className="flex w-[84px] shrink-0 justify-end">{action}</div>
      {state === "inClass" && taken && (
        <LateArrivalsSheet
          open={lateOpen}
          onClose={() => setLateOpen(false)}
          period={period}
          roster={roster}
        />
      )}
    </li>
  );
};

/**
 * 「接下來」：還沒點名的（舊的在前）→ 上課中 → 未來 7 天，一堂一列。
 * 取代舊的主角卡＋「還沒點名」兩塊；上課中的補勾遲到收進那一列的按鈕。
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
  <section aria-labelledby="agenda-heading" className="flex flex-col gap-2.5">
    <h2 id="agenda-heading" className="text-[15px] font-bold text-neutral-900">
      接下來 <span className="text-[13px] font-normal text-neutral-600">7 天內</span>
    </h2>
    {isLoading ? (
      <div aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl opacity-60" />
      </div>
    ) : rows.length === 0 ? (
      <EmptyState
        kind="inline"
        title="7 天內沒有要上的課"
        action={
          hiddenCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={onShowAll}>
              看全部 {hiddenCount} 堂
            </Button>
          ) : undefined
        }
      />
    ) : (
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {rows.map((row) => (
          <AgendaItem key={row.period.id} row={row} now={now} />
        ))}
      </ul>
    )}
  </section>
);

export default AgendaList;
