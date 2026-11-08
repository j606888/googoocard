"use client";

// 老師報酬單（設計稿「老師報酬單（手機）」）：每堂明細、等學生付款、可以領、付款狀態。
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { monthOf } from "@/domains/finance/months";
import { monthRange } from "@/domains/ledger/reports";
import { useGetMoneyAccountsQuery, useGetTeacherStatementQuery } from "@/store/slices/ledger";
import MonthSwitcher from "../MonthSwitcher";
import { Amount, FinanceCard, FinanceShell, amountText } from "./ui";

const WEEK = "日一二三四五六";
const dayLabel = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEK[d.getUTCDay()]}）`;
};

export default function TeacherStatement({ teacherId }: { teacherId: number }) {
  const [month, setMonth] = useState(monthOf(new Date()));
  const { data, isLoading, isError } = useGetTeacherStatementQuery({ teacherId, ...monthRange(month) });
  const { data: maData } = useGetMoneyAccountsQuery();
  const holder = (id: number | null) => maData?.accounts.find((a) => a.id === id)?.holderName;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${data?.teacher.name} ${Number(month.slice(5))} 月報酬單`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("已複製連結");
      }
    } catch {
      /* 使用者取消分享 */
    }
  };

  const pending = data?.payouts.filter((p) => p.status === "PENDING") ?? [];
  const paid = data?.payouts.filter((p) => p.status === "PAID") ?? [];

  return (
    <FinanceShell title="報酬單" guide="payouts" crumb={{ href: "/finance/payouts", label: "結算與付款" }} actions={<MonthSwitcher month={month} onChange={setMonth} />}>
      {isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : isError || !data ? (
        <EmptyState kind="inline" title="讀不到報酬單" />
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          <FinanceCard className="flex flex-col gap-1.5 px-5 py-5">
            <span className="text-sm text-neutral-500">
              {data.teacher.name} · {month.slice(0, 4)} 年 {Number(month.slice(5))} 月
            </span>
            <Amount cents={data.payable} dollar className="text-[34px] font-bold leading-tight" />
            <span className="text-[13px] text-neutral-500">現在可以領</span>
            {data.held > 0 && <span className="text-[13px] text-neutral-500">另有 {amountText(data.held, { dollar: true })} 等學生付款，付了下次一起發</span>}
            <div className="mt-1 flex flex-wrap gap-2">
              {pending.map((p) => (
                <span key={p.id} className="rounded-full bg-warning-100 px-2.5 py-1 text-[13px] font-semibold text-warning-950">
                  等待付款 {amountText(p.paidAmount, { dollar: true })}{holder(p.fromMoneyAccountId) && ` · ${holder(p.fromMoneyAccountId)}付`}
                </span>
              ))}
              {paid.map((p) => (
                <span key={p.id} className="rounded-full bg-primary-100 px-2.5 py-1 text-[13px] font-semibold text-primary-900">
                  已付 {amountText(p.paidAmount, { dollar: true })} · {p.paidDate?.slice(5).replace("-", "/")}
                </span>
              ))}
            </div>
          </FinanceCard>

          <FinanceCard className="px-5 pb-2 pt-3">
            <h2 className="mb-1 mt-2 text-sm font-semibold text-neutral-700">每堂明細</h2>
            {data.rows.length === 0 && <p className="py-4 text-sm text-neutral-500">這個月沒有課</p>}
            {data.rows.map((r) => (
              <div key={r.lessonPeriodId} className="flex items-start justify-between gap-3 border-t border-neutral-100 py-3.5 text-sm">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{r.lessonName}</span>
                  <span className="text-xs text-neutral-500">{dayLabel(r.startTime)} · {r.students} 人</span>
                  {r.held > 0 && <span className="text-xs text-warning-900">其中 {amountText(r.held, { decimals: true })} 等學生付款</span>}
                </span>
                <Amount cents={r.earned} decimals />
              </div>
            ))}
            {data.rows.length > 0 && (
              <div className="flex justify-between border-t border-neutral-900 py-3.5 text-sm font-bold">
                <span>這個月合計</span>
                <Amount cents={data.earned} decimals />
              </div>
            )}
          </FinanceCard>
          <Button size="lg" variant="secondary" onClick={share}>分享給 {data.teacher.name}</Button>
        </div>
      )}
    </FinanceShell>
  );
}
