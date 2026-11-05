"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import SegmentedTabs from "@/components/SegmentedTabs";
import { monthOf } from "@/domains/finance/months";
import type { BranchScope } from "@/domains/finance/waterfall";
import { cn, formatDate } from "@/lib/utils";
import { useGetFinanceHomeQuery, useGetFinanceSettingsQuery, type FinanceHomeData } from "@/store/slices/finance";
import ConfirmPaymentDrawer, { type ConfirmPaymentTarget } from "@/features/students/ConfirmPaymentDrawer";
import BindAttendanceCardDialog, { type BindCardTarget } from "@/features/BindAttendanceCardDialog";
import { UrgentTodoSections, TodoSection } from "@/features/UrgentTodoSections";
import { unsettledNotice } from "./custodyNotices";
import { defaultScope, inBranch } from "./homeTodos";
import EnableFinance from "./EnableFinance";
import SetupChecklist from "./SetupChecklist";
import MonthSwitcher from "./MonthSwitcher";
import MonthWaterfall from "./MonthWaterfall";

/** `banner`: 上方的額外提醒位置；開帳清單（未完成時）固定顯示在它下面。 */
export default function FinanceHome({ banner }: { banner?: ReactNode }) {
  const { data: settings, isLoading: settingsLoading } = useGetFinanceSettingsQuery();
  const enabled = !!settings?.enabled;
  const { data: home, isLoading: homeLoading, isError } = useGetFinanceHomeQuery(undefined, {
    skip: !enabled,
    refetchOnFocus: true,
  });
  const [month, setMonth] = useState(monthOf(new Date()));
  // null = 還沒選過，跟著預設（我負責的分部，沒有就全教室）
  const [picked, setPicked] = useState<BranchScope | null>(null);

  if (settingsLoading || (enabled && homeLoading)) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (!enabled) {
    return <EnableFinance />;
  }
  if (isError || !home) {
    return <EmptyState kind="inline" title="讀不到財務資料，請稍後再試" />;
  }

  const scope = picked ?? defaultScope(home.myLocationId, home.branches);
  const todos = scopedTodos(home, scope);
  const scopeName = scope === "all" ? "全教室" : (home.branches.find((b) => b.id === scope)?.name ?? "分部");

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {banner}
      <SetupChecklist />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {home.branches.length > 0 && (
          <SegmentedTabs
            ariaLabel="分部"
            value={String(scope)}
            onChange={(v) => setPicked(v === "all" ? "all" : Number(v))}
            options={[
              ...home.branches.map((b) => ({ value: String(b.id), label: b.name })),
              { value: "all", label: "全教室" },
            ]}
          />
        )}
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>
      <nav aria-label="財務功能" className="flex flex-wrap gap-2">
        {[
          { href: `/finance/settle/${month}`, label: "月結算單" },
          { href: "/finance/expenses", label: "支出與轉帳" },
          { href: "/finance/report", label: "月報表" },
          { href: "/finance/settings", label: "財務設定" },
        ].map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="inline-flex h-11 items-center rounded-xl border-[1.5px] border-primary-300 bg-white px-4 text-[15px] font-bold text-primary-900 hover:bg-primary-50"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className={cn("grid items-start gap-4", todos.count > 0 && "lg:grid-cols-2")}>
        {todos.count > 0 && <HomeTodos todos={todos} unsettledMonth={home.unsettledMonth} />}
        <MonthWaterfall month={month} scope={scope} scopeName={scopeName} />
      </div>
    </div>
  );
}

function scopedTodos(home: FinanceHomeData, scope: BranchScope) {
  const lists = {
    unboundAttendance: inBranch(home.unboundAttendance, scope),
    unpaidCards: inBranch(home.unpaidCards, scope),
    unpaidDropIns: inBranch(home.unpaidDropIns, scope),
    unsplitLessons: inBranch(home.unsplitLessons, scope),
    uncheckedPeriods: inBranch(home.uncheckedPeriods, scope),
    exhaustedPacks: inBranch(home.exhaustedPacks, scope),
  };
  const unsettled = unsettledNotice(home.unsettledMonth ?? undefined, monthOf(new Date()));
  const count = Object.values(lists).reduce((s, l) => s + l.length, 0) + (unsettled ? 1 : 0);
  return { ...lists, unsettled, count };
}

/** 要處理的事：待處理的三類（同一份資料、同一個處理動作）＋財務才有的。 */
function HomeTodos({ todos, unsettledMonth }: { todos: ReturnType<typeof scopedTodos>; unsettledMonth: string | null }) {
  const [payTarget, setPayTarget] = useState<ConfirmPaymentTarget | null>(null);
  const [bindTarget, setBindTarget] = useState<BindCardTarget | null>(null);
  const { unsplitLessons, uncheckedPeriods, exhaustedPacks, unsettled } = todos;

  return (
    <>
      <section aria-label="要處理的事" className="rounded-2xl border border-neutral-200 bg-white pb-2">
        <h2 className="px-4 pt-4 text-base font-semibold text-neutral-900">要處理的事</h2>
        {unsettled && unsettledMonth && (
          <TodoSection title="上月未結算" count={1} dot="bg-danger-600">
            <LinkRow href={`/finance/settle/${unsettledMonth}`} title={unsettled} subtitle="看結算單，確認結算" />
          </TodoSection>
        )}
        <UrgentTodoSections
          unboundAttendance={todos.unboundAttendance}
          unpaidCards={todos.unpaidCards}
          unpaidDropIns={todos.unpaidDropIns}
          onBind={setBindTarget}
          onPay={setPayTarget}
        />
        <TodoSection title="有課沒設分帳" count={unsplitLessons.length} dot="bg-warning-600">
          {unsplitLessons.map((l) => (
            <LinkRow key={l.lessonId} href={`/lessons/${l.lessonId}`} title={l.lessonName} subtitle="收到的錢還不知道要分給誰" />
          ))}
        </TodoSection>
        <TodoSection title="過去的時段沒點名" count={uncheckedPeriods.length} dot="bg-warning-600">
          {uncheckedPeriods.map((p) => (
            <LinkRow
              key={p.periodId}
              href={`/lessons/${p.lessonId}/periods/${p.periodId}/check`}
              title={p.lessonName}
              subtitle={formatDate(p.startTime)}
            />
          ))}
        </TodoSection>
        <TodoSection title="次數包用完" count={exhaustedPacks.length} dot="bg-warning-600">
          {exhaustedPacks.map((p) => (
            <LinkRow
              key={p.venueId}
              href="/finance/settings#venues"
              title={p.venueName}
              subtitle={p.overdrawn > 0 ? `已經超用 ${p.overdrawn} 次，記一筆新的次數包` : "剩 0 次，記一筆新的次數包"}
            />
          ))}
        </TodoSection>
      </section>
      <ConfirmPaymentDrawer target={payTarget} onClose={() => setPayTarget(null)} />
      <BindAttendanceCardDialog target={bindTarget} onClose={() => setBindTarget(null)} />
    </>
  );
}

const LinkRow = ({ href, title, subtitle }: { href: string; title: string; subtitle: string }) => (
  <Link href={href} className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-semibold text-neutral-900">{title}</span>
      <span className="truncate text-[13px] text-neutral-600">{subtitle}</span>
    </span>
    <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
  </Link>
);
