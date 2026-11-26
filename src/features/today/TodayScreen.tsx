"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DanceStyleDot from "@/components/DanceStyleDot";
import ClassroomSwitcher from "../nav/ClassroomSwitcher";
import TodoBell, { openTodoBell } from "../TodoBell";
import { timeLeftLabel } from "../lessons/lessonSchedule";
import type { AgendaRow } from "../lessons/useLessonAgenda";
import { useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import ConfirmPaymentDrawer, { type ConfirmPaymentTarget } from "../students/ConfirmPaymentDrawer";
import type { TodoScope } from "@/store/slices/todos";
import NextLessonHero from "./NextLessonHero";
import { dayLabel, type CollectItem, type TodayLesson, type TodoRow } from "./today";
import { useToday } from "./useToday";

const checkHref = ({ period }: AgendaRow) => `/lessons/${period.lesson.id}/periods/${period.id}/check`;

/** 手機上大區塊之間的 8px 淺灰帶（不是框）；桌面兩欄並排，不需要。 */
const Band = () => <div aria-hidden="true" className="-mx-5 my-7 h-2 bg-band lg:hidden" />;

const HEADING = "mb-1 text-[17px] font-semibold text-ink lg:text-[13px] lg:text-ink-3";

/** 一個區塊：手機上前面隔一條淺灰帶，桌面同一欄裡往下排。 */
const Section = ({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) => (
  <>
    <Band />
    <section aria-labelledby={id} className="lg:mb-9">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className={HEADING}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  </>
);

/** 今天稍後的課：一列一堂，右邊文字「點名」。 */
const LaterRow = ({ row, now }: { row: AgendaRow; now: Date }) => {
  const { period, state } = row;
  const taken = Boolean(period.attendanceTakenAt);
  const when =
    state === "inClass"
      ? `上課中 · ${timeLeftLabel(new Date(period.endTime), now)}`
      : format(new Date(period.startTime), "HH:mm");
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <Link href={`/lessons/${period.lesson.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <DanceStyleDot style={period.lesson.danceStyle} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-ink">{period.lesson.name}</span>
          <span className="block truncate text-[13px] tabular-nums text-ink-3">
            {[when, period.lesson.location?.name].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
      {taken ? (
        <span className="shrink-0 text-[13px] text-ink-3">已點名</span>
      ) : (
        <Button asChild variant="text" size="sm">
          <Link href={checkHref(row)}>點名</Link>
        </Button>
      )}
    </li>
  );
};

const TodoLine = ({
  count,
  children,
  sub,
}: {
  count: number;
  children: React.ReactNode;
  sub?: string;
}) => (
  <>
    <span className="min-w-7 text-xl font-semibold tabular-nums text-warning-800">{count}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] text-ink">{children}</span>
      {sub && <span className="block truncate text-[13px] text-ink-3">{sub}</span>}
    </span>
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
  </>
);

const TODO_ROW = "flex min-h-13 w-full cursor-pointer items-center gap-3 py-2 text-left";

/** 「N 堂還沒點名」：只有一堂就直接去點，不然去課程頁。 */
const OverdueRow = ({ rows }: { rows: AgendaRow[] }) => {
  const oldest = rows[0];
  if (!oldest) return null;
  return (
    <li>
      <Link href={rows.length === 1 ? checkHref(oldest) : "/lessons"} className={TODO_ROW}>
        <TodoLine
          count={rows.length}
          sub={[
            dayLabel(new Date(oldest.period.startTime)),
            oldest.period.lesson.name,
            oldest.period.lesson.location?.name,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          堂還沒點名
        </TodoLine>
      </Link>
    </li>
  );
};

/** 待處理的幾列；點下去開鈴鐺，停在同一個範圍（我的課／全教室）與分頁。 */
const TodoRows = ({ rows, scope }: { rows: TodoRow[]; scope: TodoScope }) => {
  const handleOpen = (row: TodoRow) => {
    // App 裡鈴鐺是隱藏的（待處理是原生畫面）：交給 App 開。
    if (!openTodoBell({ scope, tab: row.tab })) {
      (window as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView?.postMessage(
        "app:todos"
      );
    }
  };
  return rows.map((row) => (
    <li key={row.key}>
      <button type="button" onClick={() => handleOpen(row)} className={TODO_ROW}>
        <TodoLine count={row.count}>{row.text}</TodoLine>
      </button>
    </li>
  ));
};

const TODAY_STATUS: Record<TodayLesson["status"], { text: string; className: string }> = {
  taken: { text: "已點名", className: "text-ink-3" },
  inClass: { text: "上課中", className: "font-semibold text-primary-800" },
  overdue: { text: "還沒點名", className: "font-semibold text-warning-800" },
  upcoming: { text: "還沒開始", className: "text-ink-3" },
};

/** 全教室今天的一堂課：時間、課名、老師，右邊是點名狀態。 */
const TodayLessonRow = ({ item }: { item: TodayLesson }) => {
  const { period, status } = item;
  const { lesson } = period;
  const base = `/lessons/${lesson.id}`;
  const href = status === "taken" ? `${base}/periods/${period.id}/check-success` : base;
  const state = TODAY_STATUS[status];
  return (
    <li>
      <Link href={href} className="flex min-h-13 items-center gap-3 py-2">
        <span className="w-11 shrink-0 text-[15px] tabular-nums text-ink-2">
          {format(new Date(period.startTime), "HH:mm")}
        </span>
        <DanceStyleDot style={lesson.danceStyle} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-ink">{lesson.name}</span>
          <span className="block truncate text-[13px] text-ink-3">
            {[lesson.location?.name, lesson.teachers.map((t) => t.name).join("、")].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={`shrink-0 text-[13px] ${state.className}`}>{state.text}</span>
      </Link>
    </li>
  );
};

/** 下課要收的一筆：課卡與整期就地確認收款，單堂去點名結果頁收（可以改價）。 */
const CollectRow = ({ item, onPay }: { item: CollectItem; onPay: (target: ConfirmPaymentTarget) => void }) => (
  <li className="flex min-h-13 items-center gap-3 py-2">
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] text-ink">{item.student.name}</span>
      <span className="block truncate text-[13px] text-ink-3">{item.label}</span>
    </span>
    <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">${formatMoney(item.amount)}</span>
    {item.kind === "dropIn" ? (
      <Button asChild variant="text" size="sm">
        <Link href={item.href}>收款</Link>
      </Button>
    ) : (
      <Button
        variant="text"
        size="sm"
        onClick={() =>
          onPay({
            studentId: item.student.id,
            studentCardId: item.kind === "card" ? item.studentCardId : 0,
            enrollmentId: item.kind === "enrollment" ? item.enrollmentId : undefined,
            serialNumber: item.kind === "card" ? item.serialNumber : undefined,
            studentName: item.student.name,
            cardName: item.label,
            finalPrice: item.amount,
          })
        }
      >
        收款
      </Button>
    )}
  </li>
);

/**
 * 「今天」：登入後的第一頁。先回答「現在要做什麼」——下一堂課是唯一的主角
 * （時間放大、唯一的實心按鈕），再來才是要收的錢與待處理。不包框、不放色塊
 * （去框線改版，~/.claude/plans/quiet-redesign.md §3.1）。
 * 手機與桌面同一棵樹（docs/ui-responsive.md L1）：桌面只是把下半部排成兩欄，
 * 教室切換與鈴鐺在側欄，所以頁首那一排只在手機出現。
 *
 * 誰看到哪些區塊見 `useToday()`：我的課的待處理、下課要收的錢是每個人的；
 * 「全教室」與「追蹤」只給管理員。
 */
const TodayScreen = () => {
  const today = useToday();
  const { view, now } = today;
  const [payTarget, setPayTarget] = useState<ConfirmPaymentTarget | null>(null);
  const location = view.hero?.period.lesson.location?.name;

  const subline = [
    today.dateLabel,
    location,
    today.todayCount !== null && (today.todayCount > 0 ? `今天教 ${today.todayCount} 堂` : "今天沒有課"),
  ]
    .filter(Boolean)
    .join(" · ");

  // 管理員沒有自己的課時，主角卡已經在看全教室——「我的」那一區跟全教室重複，不列。
  const showMine = !(today.isAdmin && view.scope === "all");
  const collectTotal = today.collect.reduce((sum, item) => sum + item.amount, 0);
  const allUrgent = today.allTodoRows.filter((row) => row.tab === "urgent");
  const allReminders = today.allTodoRows.filter((row) => row.tab === "reminders");

  const todoSection = showMine && (view.overdue.length > 0 || today.todoRows.length > 0) && (
    <Section key="todo" id="todo-heading" title="待處理">
      <ul className="divide-y divide-line">
        <OverdueRow rows={view.overdue} />
        <TodoRows rows={today.todoRows} scope="mine" />
      </ul>
    </Section>
  );
  const collectSection = today.collect.length > 0 && (
    <Section
      key="collect"
      id="collect-heading"
      title="下課要收的錢"
      aside={<span className="text-[13px] tabular-nums text-ink-3">共 ${formatMoney(collectTotal)}</span>}
    >
      <ul className="divide-y divide-line">
        {today.collect.map((item) => (
          <CollectRow key={item.key} item={item} onPay={setPayTarget} />
        ))}
      </ul>
    </Section>
  );
  const classroomSection = today.isAdmin &&
    (view.allToday.length > 0 || view.allOverdue.length > 0 || allUrgent.length > 0) && (
      <Section key="classroom" id="classroom-heading" title="全教室">
        {view.allToday.length > 0 && (
          <ul aria-label="全教室今天的課" className="divide-y divide-line border-b border-line">
            {view.allToday.map((item) => (
              <TodayLessonRow key={item.period.id} item={item} />
            ))}
          </ul>
        )}
        <ul className="divide-y divide-line">
          <OverdueRow rows={view.allOverdue} />
          <TodoRows rows={allUrgent} scope="all" />
        </ul>
      </Section>
    );
  const followSection = today.isAdmin && allReminders.length > 0 && (
    <Section key="follow" id="follow-heading" title="追蹤">
      <ul className="divide-y divide-line">
        <TodoRows rows={allReminders} scope="all" />
      </ul>
    </Section>
  );

  const mine = (today.collectFirst ? [collectSection, todoSection] : [todoSection, collectSection]).filter(Boolean);
  const classroom = [classroomSection, followSection].filter(Boolean);
  // 桌面兩欄：管理員左邊是自己的、右邊是全教室；其他人（或沒有自己的課的管理員）把手上的區塊左右分開。
  const [left, right] =
    mine.length > 0 && classroom.length > 0
      ? [mine, classroom]
      : [[...mine, ...classroom].slice(0, 1), [...mine, ...classroom].slice(1)];

  return (
    <div className="flex flex-col px-5 pb-10 lg:max-w-[1180px] lg:px-12 lg:pt-9">
      <div className="flex h-12 items-center lg:hidden">
        <ClassroomSwitcher />
        <TodoBell />
      </div>

      <header className="mt-1 flex flex-col-reverse gap-0.5 lg:mt-0 lg:flex-row lg:items-baseline lg:justify-between">
        <h1 className="min-h-9 text-[28px] font-semibold leading-9 tracking-[-0.01em] text-ink lg:text-[26px]">
          {today.greeting && `${today.greeting}${today.name ? `，${today.name}` : ""}`}
        </h1>
        <p className="min-h-5 text-[13px] text-ink-3 lg:text-sm">{subline}</p>
      </header>

      <div className="mt-7 lg:mt-10">
        {today.isLoading ? (
          <Skeleton aria-busy="true" className="h-56 w-full rounded-2xl" />
        ) : (
          <>
            <NextLessonHero row={view.hero} now={now} isToday={view.heroIsToday} />
            {view.later.length > 0 && (
              <ul aria-label="今天稍後的課" className="divide-y divide-line border-b border-line">
                {view.later.map((row) => (
                  <LaterRow key={row.period.id} row={row} now={now} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="lg:mt-9 lg:grid lg:grid-cols-2 lg:gap-x-16">
        <div>{left}</div>
        <div>{right}</div>
      </div>
      <ConfirmPaymentDrawer target={payTarget} onClose={() => setPayTarget(null)} />
    </div>
  );
};

export default TodayScreen;
