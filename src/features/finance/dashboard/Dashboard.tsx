"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import DataView, { type DataViewColumn } from "@/components/DataView";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import { useGetMeQuery } from "@/store/slices/me";
import FinancePageHeader from "../FinancePageHeader";
import Money, { EXPENSE_TEXT, INCOME_TEXT, moneyText } from "../Money";
import {
  BRANCHES,
  branchPools,
  inTransit,
  mainPool,
  monthSummary,
  pendingTasks,
  period,
  tankLevel,
  transactions,
  weekly,
} from "../mockData";
import { financeHref } from "../routes";
import type { PendingTaskTone, Transaction } from "../types";
import { LaterAction, Panel, PanelTitle } from "../ui";
import { remittable } from "../funds/poolMath";
import { isArchived } from "../ledger/ledgerHistory";
import WeeklyChart from "./WeeklyChart";

function greeting(hour: number) {
  if (hour < 11) return "早安";
  if (hour < 18) return "午安";
  return "晚安";
}

export default function Dashboard() {
  const { data: me } = useGetMeQuery();
  const canEdit = useCan("finance.edit");

  const expense = monthSummary.expense.rent + monthSummary.expense.other;
  const toTank = monthSummary.toTank.contribution + monthSummary.toTank.leftover;
  const ratePercent = Math.round(monthSummary.toTank.poolRate * 100);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        title={`${greeting(new Date().getHours())}${me ? `，${me.name}` : ""}`}
        description={`${period.monthLabel} · ${BRANCHES.join("＋")}`}
        actions={
          <>
            <LaterAction size="sm">據點：全部</LaterAction>
            {canEdit && (
              <Button asChild>
                <Link href={financeHref("ledger")}>
                  <Plus className="size-4" />
                  記一筆
                </Link>
              </Button>
            )}
          </>
        }
      />

      <TankLevelCard />

      <section aria-label="本月概況" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="本月收入（已認列）"
          note={`${monthSummary.income.classes} 堂課 · 另售出課卡 ${moneyText(monthSummary.income.cardSales)}`}
        >
          <Money value={monthSummary.income.recognized} className={INCOME_TEXT} />
        </StatCard>
        <StatCard
          label="本月支出"
          note={`場租 ${moneyText(monthSummary.expense.rent)} · 其他 ${moneyText(monthSummary.expense.other)}`}
        >
          <Money value={expense} className={EXPENSE_TEXT} />
        </StatCard>
        <StatCard
          label="本月流入水庫"
          note={`提撥 ${ratePercent}% ${moneyText(monthSummary.toTank.contribution)} · 零頭 ${moneyText(monthSummary.toTank.leftover)}`}
        >
          <Money value={toTank} />
        </StatCard>
        <StatCard label="距離發薪日" note={`${period.payday} 發放 · ${period.closeDay} 關帳`}>
          <span className="tabular-nums">{period.daysToPayday}</span>
          <span className="ml-1 text-sm font-normal text-neutral-500">天</span>
        </StatCard>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <WeeklyChart weeks={weekly} />
        <FundLocations />
        <PendingTasks />
      </div>

      <RecentTransactions rows={transactions.filter((tx) => !isArchived(tx)).slice(0, 4)} />
    </div>
  );
}

/** 水庫水位：帳上餘額＋未認列預收＝實質水位（深綠底，設計系統唯一允許的深底）。 */
function TankLevelCard() {
  const real = tankLevel.booked + tankLevel.unrecognizedPrepaid;
  return (
    <section aria-label="水位" className="flex flex-col gap-4 rounded-2xl bg-primary-900 px-5 py-5 text-white lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-medium text-primary-100">水庫水位</h3>
        <div className="text-[13px] text-primary-100">更新於 {period.todayShort} {tankLevel.updatedAt}</div>
      </div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 lg:gap-x-7">
        <TankFigure label="帳上餘額" value={tankLevel.booked} className={tankLevel.booked < 0 ? "text-warning-300" : ""} />
        <Operator>＋</Operator>
        <TankFigure label="未認列預收課卡" value={tankLevel.unrecognizedPrepaid} />
        <Operator>＝</Operator>
        <TankFigure label="實質水位" value={real} className="font-bold" />
      </div>
      <p className="max-w-[720px] text-sm leading-7 text-primary-100">
        帳上是負的不代表虧錢：課卡賣出時記為「預收」，學員每上一堂才認列成收入。目前還有{" "}
        <span className="tabular-nums">{tankLevel.unusedClasses}</span> 堂課卡尚未使用。
      </p>
    </section>
  );
}

function TankFigure({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className="text-[13px] text-primary-100">{label}</div>
      <Money value={value} className={cn("text-3xl font-semibold lg:text-[40px]", className)} />
    </div>
  );
}

function Operator({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="pb-1 text-2xl text-primary-300 lg:text-[28px]">
      {children}
    </span>
  );
}

function StatCard({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <div className="text-[13px] text-neutral-500 lg:text-sm">{label}</div>
      <div className="text-2xl font-semibold text-neutral-900 lg:text-[28px]">{children}</div>
      <div className="text-xs text-neutral-500 lg:text-[13px]">{note}</div>
    </div>
  );
}

/** 錢在誰手上：大水庫的各個位置、各據點小水庫、轉帳中。 */
function FundLocations() {
  const rows = [
    ...mainPool.positions.map((p) => ({
      id: `main-${p.id}`,
      name: `大水庫 · ${p.name}`,
      note: [p.note, p.canDeposit ? "可存進銀行" : null].filter(Boolean).join("，"),
      amount: p.amount,
      mustReturn: false,
    })),
    ...branchPools.map((pool) => ({
      id: `pool-${pool.id}`,
      name: `${pool.name} · ${pool.keeper}`,
      note: `可繳回 ${moneyText(remittable(pool))}`,
      amount: pool.balance,
      mustReturn: true,
    })),
    ...inTransit.map((r) => ({
      id: `transit-${r.id}`,
      name: "轉帳中",
      note: `${r.from} → 大水庫，等${mainPool.accountant}確認`,
      amount: r.amount,
      mustReturn: false,
    })),
  ];

  return (
    <Panel className="flex flex-col p-4 lg:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <PanelTitle>錢在誰手上</PanelTitle>
        <Button variant="link" asChild className="text-sm">
          <Link href={financeHref("funds")}>資金與繳回</Link>
        </Button>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 py-3 last:border-0">
          <div className="min-w-0">
            <div className="text-[15px] text-neutral-900">{row.name}</div>
            {row.note && (
              <div className={cn("text-[13px]", row.mustReturn ? EXPENSE_TEXT : "text-neutral-500")}>{row.note}</div>
            )}
          </div>
          <Money value={row.amount} className="shrink-0 text-[17px] text-neutral-900" />
        </div>
      ))}
    </Panel>
  );
}

const TASK_TONES: Record<PendingTaskTone, { box: string; link: string }> = {
  water: { box: "bg-primary-50 hover:bg-primary-100", link: "text-primary-900" },
  expense: { box: "bg-warning-50 hover:bg-warning-100", link: "text-warning-950" },
  neutral: { box: "bg-neutral-50 hover:bg-neutral-100", link: "text-neutral-600" },
};

function PendingTasks() {
  return (
    <Panel className="flex flex-col gap-3 p-4 lg:p-6">
      <PanelTitle className="mb-1">待處理</PanelTitle>
      {pendingTasks.map((task) => (
        <Link
          key={task.id}
          href={financeHref(task.page)}
          className={cn(
            "flex min-h-11 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 transition-colors",
            TASK_TONES[task.tone].box
          )}
        >
          <span className="text-[15px] text-neutral-900">{task.label}</span>
          <span className={cn("inline-flex shrink-0 items-center text-sm font-medium", TASK_TONES[task.tone].link)}>
            {task.action}
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      ))}
    </Panel>
  );
}

const RECENT_COLUMNS: DataViewColumn<Transaction>[] = [
  {
    key: "description",
    header: "項目",
    width: "minmax(0,2fr)",
    role: "primary",
    render: (tx) => (
      <span className="block truncate text-sm text-neutral-900 lg:text-[15px]">
        {tx.category} · {tx.description}
      </span>
    ),
  },
  { key: "date", header: "日期", width: "64px", render: (tx) => <span className="tabular-nums">{tx.date}</span> },
  { key: "branch", header: "據點", width: "64px", render: (tx) => tx.branch },
  { key: "holder", header: "經手人／資金位置", width: "minmax(0,1fr)", render: (tx) => <span className="truncate">{tx.holder}</span> },
  {
    key: "amount",
    header: "金額",
    width: "96px",
    role: "trailing",
    render: (tx) => <Money value={tx.amount} sign colored className="ml-auto text-sm font-semibold lg:text-[15px]" />,
  },
];

function RecentTransactions({ rows }: { rows: Transaction[] }) {
  return (
    <section aria-label="最近交易" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <PanelTitle>最近交易</PanelTitle>
        <Button variant="link" asChild className="text-sm">
          <Link href={financeHref("ledger")}>看全部流水帳</Link>
        </Button>
      </div>
      <DataView columns={RECENT_COLUMNS} rows={rows} rowKey={(tx) => tx.id} />
    </section>
  );
}
