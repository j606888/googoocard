"use client";

// 財務總覽（docs/finance-v2/05 §3.1；設計稿「總覽 /finance」）。
import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import { monthOf } from "@/domains/finance/months";
import { monthRange } from "@/domains/ledger/reports";
import { formatCardSerial } from "@/lib/cardSerial";
import { cn } from "@/lib/utils";
import { useGetFinanceOverviewQuery, type FinanceOverview } from "@/store/slices/ledger";
import { useFinanceEnabled } from "@/features/nav/useFinanceEnabled";
import EnableFinance from "../EnableFinance";
import MonthSwitcher from "../MonthSwitcher";
import { Amount, BranchSwitch, FinanceCard, FinanceShell, amountText, pick } from "./ui";

export default function Overview() {
  const enabled = useFinanceEnabled();
  const [month, setMonth] = useState(monthOf(new Date()));
  const [loc, setLoc] = useState<number | null>(null);
  const range = monthRange(month);
  const { data, isLoading, isError } = useGetFinanceOverviewQuery(range, { skip: !enabled, refetchOnFocus: true });

  if (!enabled) return <EnableFinance />;

  return (
    <FinanceShell
      title="財務"
      actions={
        <>
          <Link
            href="/finance/guide"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary-800 hover:bg-primary-50"
          >
            <BookOpen className="size-4" aria-hidden />
            使用教學
          </Link>
          {data && <BranchSwitch locations={data.locations} value={loc} onChange={setLoc} />}
          <MonthSwitcher month={month} onChange={setMonth} />
        </>
      }
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : isError || !data ? (
        <EmptyState kind="inline" title="讀不到財務資料，請稍後再試" />
      ) : (
        <OverviewBody data={data} loc={loc} />
      )}
    </FinanceShell>
  );
}

function Kpi({ href, label, children, sub }: { href: string; label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white px-5 py-4 transition-colors hover:border-neutral-300">
      <span className="text-[13px] text-neutral-500">{label}</span>
      <span className="text-[28px] font-bold leading-tight text-neutral-900">{children}</span>
      {sub && <span className="text-[13px] text-neutral-500">{sub}</span>}
    </Link>
  );
}

function OverviewBody({ data, loc }: { data: FinanceOverview; loc: number | null }) {
  const accounts = data.cash.accounts.filter((a) => loc === null || a.locationId === loc);
  const cash = pick(data.cash, loc);
  const owed = pick(data.deferred, loc) + pick(data.payable, loc) + pick(data.held, loc);
  const gap = owed - cash;
  const net = pick(data.netIncome, loc);
  const fundLocs = loc === null ? data.locations : data.locations.filter((l) => l.id === loc);
  const todos = data.todos;
  const receivables = todos.receivables.filter((r) => loc === null || r.locationId === loc);

  return (
    <div className="flex flex-col gap-4">
      {!data.opened && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4 text-warning-950">
          <Link href="/finance/opening" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex-1 text-[15px] font-semibold">還沒開帳：先選一天開帳，帳本的數字才完整</span>
            <ChevronRight className="size-5 shrink-0" />
          </Link>
          <Link href="/finance/guide#setup" className="text-sm font-semibold underline underline-offset-4">
            第一次用？看使用教學
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi href="/finance/reports/pnl" label="本月淨利" sub={<>毛利 <Amount cents={pick(data.grossProfit, loc)} dollar /> · 支出 <Amount cents={pick(data.expenses, loc)} dollar /></>}>
          <Amount cents={net} dollar />
        </Kpi>
        <Kpi
          href="/finance/accounts"
          label="資金帳戶"
          sub={accounts.map((a, i) => (
            <span key={a.id}>
              {i > 0 && " · "}
              {a.name.replace(/的現金$/, "")} <Amount cents={a.balance} dollar />
            </span>
          ))}
        >
          <Amount cents={cash} dollar />
        </Kpi>
        <Kpi
          href="/finance/reports/deferred-revenue"
          label="預收學費"
          sub={loc === null ? `${data.deferred.cards} 張卡 · 還有 ${data.deferred.sessions} 堂沒上` : undefined}
        >
          <Amount cents={pick(data.deferred, loc)} dollar />
        </Kpi>
        <Kpi href="/finance/payouts" label="應付老師與場地" sub={pick(data.held, loc) > 0 ? <>另有待學生付款 <Amount cents={pick(data.held, loc)} dollar /></> : undefined}>
          <Amount cents={pick(data.payable, loc)} dollar />
        </Kpi>
        <Kpi
          href="/finance/reports/receivables"
          label="應收學費"
          sub={receivables.length > 0 ? `${receivables.length} 筆 · 最久 ${data.receivable.maxAgeDays} 天` : undefined}
        >
          <Amount cents={pick(data.receivable, loc)} dollar />
        </Kpi>
        <Link href="/finance/reports/balance-sheet" className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white px-5 py-4 transition-colors hover:border-neutral-300">
          <span className="text-[13px] text-neutral-500">公積金</span>
          {fundLocs.map((l) => (
            <span key={l.id} className="text-xl font-bold leading-normal">
              {fundLocs.length > 1 && <span className="mr-1.5">{l.name}</span>}
              <Amount cents={data.fund.byLocation[l.id] ?? 0} dollar />
            </span>
          ))}
        </Link>
      </div>

      <FinanceCard className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[15px] font-semibold">手上的錢 vs 欠的</h2>
          <InfoTip label="說明">欠的＝預收學費（還沒上的課）＋應付老師與場地。手上的錢比欠的少，表示已經先用了學生的預付款。</InfoTip>
          {gap > 0 ? (
            <span className="ml-auto rounded-full bg-warning-100 px-2.5 py-0.5 text-sm font-semibold text-warning-950">差 {amountText(gap, { dollar: true })}</span>
          ) : (
            <span className="ml-auto rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-semibold text-primary-900">夠</span>
          )}
        </div>
        <Bar label="手上的錢" value={cash} max={Math.max(cash, owed, 1)} tone="bg-primary-600" />
        <Bar label="預收＋應付" value={owed} max={Math.max(cash, owed, 1)} tone="bg-neutral-400" />
      </FinanceCard>

      <div className="flex flex-wrap gap-3">
        <Trend data={data} loc={loc} />
        <FinanceCard className="flex min-w-0 flex-[1_1_300px] flex-col px-5 py-4">
          <h2 className="mb-2 text-[15px] font-semibold">要處理的事</h2>
          {todos.pendingPayouts.count > 0 && (
            <Todo href="/finance/payouts" title={`${todos.pendingPayouts.count} 筆付款等待付款`} sub={amountText(todos.pendingPayouts.amount, { dollar: true })} />
          )}
          {todos.pendingTransfers.count > 0 && (
            <Todo href="/finance/payouts" title="分部往來待轉平" sub={amountText(todos.pendingTransfers.amount, { dollar: true })} />
          )}
          {receivables.map((r) => (
            <Todo
              key={`${r.partyType}:${r.partyId}`}
              href={r.studentId ? `/students/${r.studentId}` : "/finance/reports/receivables"}
              title={r.studentName ? `${r.studentName}${r.serialNumber ? ` ${formatCardSerial(r.serialNumber)}` : ""} 還沒付款` : "單堂還沒付款"}
              sub={`${amountText(r.balance, { dollar: true })} · ${r.ageDays} 天`}
            />
          ))}
          {todos.closeDue && <Todo href="/finance/close" title={`${Number(todos.closeDue.slice(5, 7))} 月還沒結帳`} sub="結帳清單" />}
          {todos.ledgerErrors > 0 && <Todo href="/finance/close" title="帳本有記不進去的紀錄" sub={`${todos.ledgerErrors} 筆`} />}
          {todos.pendingPayouts.count + todos.pendingTransfers.count + receivables.length + todos.ledgerErrors === 0 && !todos.closeDue && (
            <p className="py-3 text-sm text-neutral-500">沒有要處理的事</p>
          )}
        </FinanceCard>
      </div>
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_96px] items-center gap-3 text-[13px]">
      <span className="text-neutral-500">{label}</span>
      <div className="h-3.5 rounded bg-neutral-100">
        <div className={cn("h-full rounded", tone)} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      </div>
      <Amount cents={value} dollar className="text-right font-semibold" />
    </div>
  );
}

function Todo({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 border-t border-neutral-100 py-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-neutral-900">{title}</span>
        <span className="text-[13px] text-neutral-500 tabular-nums">{sub}</span>
      </span>
      <ChevronRight className="size-4 text-neutral-500" />
    </Link>
  );
}

function Trend({ data, loc }: { data: FinanceOverview; loc: number | null }) {
  const vals = data.trend.map((t) => ({
    month: t.month,
    income: t.income ? pick(t.income, loc) : null,
    net: t.netIncome ? pick(t.netIncome, loc) : null,
  }));
  const max = Math.max(1, ...vals.flatMap((v) => [Math.abs(v.income ?? 0), Math.abs(v.net ?? 0)]));
  const h = (x: number) => `${(Math.abs(x) / max) * 100}%`;
  return (
    <FinanceCard className="flex min-w-0 flex-[2_1_420px] flex-col gap-3 px-5 py-4" aria-label="近六個月">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-[15px] font-semibold">近六個月</h2>
        <span className="flex items-center gap-1.5 text-[13px] text-neutral-500"><span className="size-2.5 rounded-sm bg-primary-600" />收入</span>
        <span className="flex items-center gap-1.5 text-[13px] text-neutral-500"><span className="size-2.5 rounded-sm bg-[#C96A3B]" />淨利</span>
      </div>
      <div className="grid h-44 grid-cols-6 items-end gap-3 border-b border-neutral-300 px-1">
        {vals.map((v) =>
          v.income === null ? (
            <div key={v.month} className="flex h-full items-end justify-center"><div className="w-3/4 border-t-2 border-dashed border-neutral-200" /></div>
          ) : (
            <div key={v.month} className="flex h-full items-end justify-center gap-1" title={`收入 ${amountText(v.income, { dollar: true })} · 淨利 ${amountText(v.net ?? 0, { dollar: true })}`}>
              <div className="w-[36%] rounded-t bg-primary-600" style={{ height: h(v.income) }} />
              <div className={cn("w-[36%] bg-[#C96A3B]", (v.net ?? 0) < 0 ? "opacity-60" : "rounded-t")} style={{ height: h(v.net ?? 0) }} />
            </div>
          ),
        )}
      </div>
      <div className="grid grid-cols-6 gap-3 px-1 text-center text-xs text-neutral-500">
        {vals.map((v) => <span key={v.month}>{Number(v.month.slice(5))} 月</span>)}
      </div>
      {vals.some((v) => v.income === null) && <span className="text-xs text-neutral-500">{data.conversionDate.replaceAll("-", "/")} 開帳，之前的月份沒有帳</span>}
    </FinanceCard>
  );
}
