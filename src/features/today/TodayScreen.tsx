"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DanceStyleTile from "@/components/DanceStyleTile";
import KiwiLogo from "@/components/KiwiLogo";
import ClassroomSwitcher from "../nav/ClassroomSwitcher";
import TodoBell, { openTodoBell } from "../TodoBell";
import { timeLeftLabel } from "../lessons/lessonSchedule";
import type { AgendaRow } from "../lessons/useLessonAgenda";
import NextLessonHero from "./NextLessonHero";
import RecentPeriods from "./RecentPeriods";
import { dayLabel } from "./today";
import { useToday } from "./useToday";

/** 逾期最多列幾堂；再多就帶去課程頁。 */
const OVERDUE_SHOWN = 3;

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
    {children}
  </span>
);

const checkHref = ({ period }: AgendaRow) => `/lessons/${period.lesson.id}/periods/${period.id}/check`;

/** 今天稍後的課：一列一堂，右邊點名。 */
const LaterRow = ({ row, now }: { row: AgendaRow; now: Date }) => {
  const { period, state } = row;
  const taken = Boolean(period.attendanceTakenAt);
  const people = period.lesson.teachers.map((t) => t.name).join("、");
  const when =
    state === "inClass"
      ? `上課中 · ${timeLeftLabel(new Date(period.endTime), now)}`
      : `今天 ${format(new Date(period.startTime), "HH:mm")}`;
  return (
    <li className="flex min-h-15 items-center gap-3 rounded-2xl border border-transparent bg-white px-3 py-2 lg:border-neutral-200">
      <Link href={`/lessons/${period.lesson.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <DanceStyleTile style={period.lesson.danceStyle} name={period.lesson.name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-neutral-900">
            {period.lesson.name}
          </span>
          <span className="block truncate text-[13px] tabular-nums text-neutral-600">
            {[when, people].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
      {taken ? (
        <span className="shrink-0 text-[13px] text-neutral-600">已點名</span>
      ) : (
        <Button asChild variant="secondary" size="sm">
          <Link href={checkHref(row)}>點名</Link>
        </Button>
      )}
    </li>
  );
};

/**
 * 「今天」：登入後的第一頁。先回答「我是誰、我在哪、現在要做什麼」——
 * 問候＋角色，下一堂課是唯一的主角，再來才是待處理與最近上過。
 * 手機與桌面同一棵樹（docs/ui-responsive.md L1）：桌面只是把內容排成兩欄，
 * 教室切換與鈴鐺在側欄，所以頁首那一排只在手機出現。
 */
const TodayScreen = () => {
  const today = useToday();
  const { view, now } = today;
  const location = view.hero?.period.lesson.location?.name;

  const handleTodos = () => {
    // App 裡鈴鐺是隱藏的（待處理是原生畫面）：交給 App 開。
    if (!openTodoBell()) {
      (window as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView?.postMessage(
        "app:todos"
      );
    }
  };

  // -mb-24/pb-24: the layout keeps 6rem of white for the bottom nav; pull the grey ground under it.
  return (
    <div className="-mb-24 flex min-h-screen flex-col bg-neutral-100 pb-24 lg:mb-0 lg:min-h-0 lg:bg-white lg:pb-0">
      <header className="relative overflow-hidden rounded-b-[32px] bg-primary-900 px-5 pb-14 pt-2 text-white lg:mx-8 lg:mt-6 lg:rounded-3xl lg:px-8 lg:pb-7 lg:pt-7">
        <div className="flex h-12 items-center lg:hidden">
          <ClassroomSwitcher tone="onPrimary" />
          <TodoBell tone="onPrimary" />
        </div>
        <p className="mt-2 min-h-5 text-[13px] font-medium text-primary-100 lg:mt-0">
          {[today.dateLabel, location].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-0.5 min-h-10 text-[30px] font-bold leading-10">
          {today.greeting && `${today.greeting}${today.name ? `，${today.name}` : ""}`}
        </h1>
        <div className="mt-1.5 flex min-h-6 flex-wrap gap-1.5">
          {today.roleLabel && <Chip>{today.roleLabel}</Chip>}
          {today.todayCount !== null && (
            <Chip>{today.todayCount > 0 ? `今天教 ${today.todayCount} 堂` : "今天沒有課"}</Chip>
          )}
        </div>
        <KiwiLogo className="pointer-events-none absolute bottom-9 right-6 w-[88px] text-accent-500 lg:bottom-6 lg:right-10 lg:w-[104px]" />
      </header>

      <div className="relative z-10 -mt-9 grid gap-4 px-4 pb-8 lg:mt-6 lg:max-w-[1100px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6 lg:px-8">
        <div className="flex flex-col gap-3">
          {today.isLoading ? (
            <Skeleton aria-busy="true" className="h-56 w-full rounded-3xl bg-white" />
          ) : (
            <>
              <NextLessonHero row={view.hero} now={now} isToday={view.heroIsToday} />

              {view.overdue.length > 0 && (
                <section
                  aria-labelledby="overdue-heading"
                  className="rounded-2xl bg-warning-100 px-3 py-2.5"
                >
                  <h2 id="overdue-heading" className="px-1 text-sm font-bold text-warning-950">
                    {view.overdue.length} 堂還沒點名
                  </h2>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {view.overdue.slice(0, OVERDUE_SHOWN).map((row) => (
                      <li
                        key={row.period.id}
                        className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-3 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                          <span className="font-semibold tabular-nums">
                            {dayLabel(new Date(row.period.startTime))}
                          </span>{" "}
                          {row.period.lesson.name}
                        </span>
                        <Button asChild variant="secondary" size="sm">
                          <Link href={checkHref(row)}>補點名</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {view.overdue.length > OVERDUE_SHOWN && (
                    <Link
                      href="/lessons"
                      className="mt-2 block px-1 text-[13px] font-semibold text-warning-950 underline-offset-4 hover:underline"
                    >
                      還有 {view.overdue.length - OVERDUE_SHOWN} 堂，到課程頁看全部
                    </Link>
                  )}
                </section>
              )}

              {view.later.length > 0 && (
                <ul aria-label="今天稍後的課" className="flex flex-col gap-2">
                  {view.later.map((row) => (
                    <LaterRow key={row.period.id} row={row} now={now} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {today.todo && (
            <button
              type="button"
              onClick={handleTodos}
              className={`flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left ${
                today.todo.urgent ? "bg-accent-50 text-accent-950" : "bg-white text-neutral-800"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  today.todo.urgent ? "bg-accent-200" : "bg-neutral-100"
                }`}
              >
                {today.todo.count}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{today.todo.text}</span>
              <ChevronRight aria-hidden="true" className="size-[18px] shrink-0" />
            </button>
          )}
          <RecentPeriods periods={today.recent} isLoading={today.recentLoading} />
        </div>
      </div>
    </div>
  );
};

export default TodayScreen;
