"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import { Skeleton } from "@/components/ui/skeleton";
import { monthOf } from "@/domains/finance/months";
import { formatMoney } from "@/lib/money";
import { useGetFinanceSettingsQuery, useGetMonthStatementQuery } from "@/store/slices/finance";
import MonthSwitcher from "./MonthSwitcher";

type Row = { key: string; label: string; income: number; sessions: number; students: number };

/** 月報表：各分部與全教室的已實現收入、上課人次、學生數，以及每位老師這個月賺多少。 */
export default function ReportView() {
  const [month, setMonth] = useState(monthOf(new Date()));
  const { data: settings, isLoading: settingsLoading } = useGetFinanceSettingsQuery();
  const enabled = !!settings?.enabled;
  const { data: statement, isLoading, isError } = useGetMonthStatementQuery(month, { skip: !enabled });

  if (settingsLoading) return <Skeleton className="m-4 h-56 rounded-2xl lg:m-6" />;
  if (!enabled) return <EmptyState kind="page" title="這間教室還沒開財務" />;

  const branches = statement?.byBranch ?? [];
  const all: Row[] = [
    ...branches.map((b) => ({ key: String(b.locationId), label: b.name, income: b.revenue, sessions: b.sessions, students: b.students })),
    {
      key: "all",
      label: "全教室",
      income: branches.reduce((s, b) => s + b.revenue, 0),
      sessions: branches.reduce((s, b) => s + b.sessions, 0),
      // 全教室的學生數：同一位學生跨分部只算一次
      students: new Set((statement?.periods ?? []).flatMap((p) => p.income.realized.map((r) => r.studentId))).size,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <MonthSwitcher month={month} onChange={setMonth} />
      {isLoading ? (
        <Skeleton className="h-56 w-full rounded-2xl" />
      ) : isError || !statement ? (
        <EmptyState kind="inline" title="讀不到這個月的資料，請稍後再試" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
            <h2 className="mb-2 flex items-center gap-1 text-base font-semibold text-neutral-900">
              收入
              <InfoTip label="收入說明">只算已付款、已經上過課的收入（已實現）。人次＝來上課的次數，學生＝不同的人（同一位學生來兩次算 2 人次、1 位學生），也只算這些。</InfoTip>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-neutral-500">
                    <th className="py-2 font-normal">分部</th>
                    <th className="py-2 text-right font-normal">收入</th>
                    <th className="py-2 text-right font-normal">人次</th>
                    <th className="py-2 text-right font-normal">學生</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {all.map((r) => (
                    <tr key={r.key} className={r.key === "all" ? "font-semibold" : undefined}>
                      <td className="py-2.5 text-neutral-900">{r.label}</td>
                      <td className="py-2.5 text-right tabular-nums">${formatMoney(r.income)}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.sessions}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
            <h2 className="mb-2 flex items-center gap-1 text-base font-semibold text-neutral-900">
              老師這個月賺多少
              <InfoTip label="老師收入說明">不分地區，各堂分潤加上調整。</InfoTip>
            </h2>
            {statement.byPerson.length === 0 ? (
              <EmptyState kind="inline" title="這個月沒有老師分潤" />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {statement.byPerson.map((p) => (
                  <li key={p.teacherId} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-neutral-900">{p.name}</span>
                    <span className="font-medium tabular-nums">${formatMoney(p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
