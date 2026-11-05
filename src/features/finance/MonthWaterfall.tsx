"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import { Skeleton } from "@/components/ui/skeleton";
import { monthWaterfall, roundWaterfall, type BranchScope, type Waterfall } from "@/domains/finance/waterfall";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useGetMonthStatementQuery } from "@/store/slices/finance";
import { formatSigned } from "./CustodyCard";
import { monthLabel } from "./financeUi";

const Row = ({
  label,
  tip,
  sign,
  amount,
  strong,
}: {
  label: string;
  tip?: string;
  sign: "+" | "−" | "=";
  amount: number;
  strong?: boolean;
}) => (
  <li className={cn("flex items-center justify-between gap-3 py-2.5 text-sm", strong && "font-semibold")}>
    <span className="flex min-w-0 items-center gap-1 text-neutral-800">
      <span aria-hidden className="w-4 shrink-0 text-center text-neutral-400">
        {sign}
      </span>
      {label}
      {tip && <InfoTip label={`${label}說明`}>{tip}</InfoTip>}
    </span>
    <span className="shrink-0 tabular-nums text-neutral-900">
      {sign === "=" ? formatSigned(amount) : `$${formatMoney(Math.abs(amount))}`}
    </span>
  </li>
);

/** 本月收支瀑布：收入 → 老師 → 場地 → 進公積金 → 支出 → 本月淨變化（＝公積金變化）。 */
export default function MonthWaterfall({
  month,
  scope,
  scopeName,
}: {
  month: string;
  scope: BranchScope;
  scopeName: string;
}) {
  const { data: statement, isLoading, isError } = useGetMonthStatementQuery(month);

  if (isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (isError || !statement) return <EmptyState kind="inline" title="讀不到這個月的資料，請稍後再試" />;

  const w = monthWaterfall(statement, scope);

  return (
    <section aria-label="本月收支" className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <h2 className="flex items-center gap-1 text-base font-semibold text-neutral-900">
        {scopeName} · {monthLabel(month)}收支
        <InfoTip label="收支說明">
          收入只算已經上過、已付款的課。分部看的是「這堂課的基金」，不是上課地點。本月淨變化就是這個分部公積金這個月的變化。
        </InfoTip>
      </h2>
      <WaterfallRows w={w} />
      {w.lessons.length > 0 && (
        <details className="mt-2 border-t border-neutral-100 pt-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-900">每堂課（{w.lessons.length} 門）</summary>
          <ul className="mt-1 divide-y divide-neutral-100">
            {w.lessons.map((l) => (
              <li key={l.lessonId}>
                <Link href={`/lessons/${l.lessonId}`} className="flex min-h-11 items-center gap-3 py-2 text-sm hover:bg-neutral-50">
                  <span className="min-w-0 flex-1 truncate text-neutral-800">
                    {l.lessonName}
                    <span className="ml-1.5 text-[13px] text-neutral-500">{l.periods} 堂</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-900">${formatMoney(l.income)}</span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** 瀑布的各列（首頁與結算單各分部共用）。各列先取整、尾差併進「過期收入與調整」，加減一定對得上。 */
export function WaterfallRows({ w: raw }: { w: Waterfall }) {
  const w = roundWaterfall(raw);
  const show = (x: number) => x !== 0;
  return (
    <ul className="mt-1 divide-y divide-neutral-100">
      <Row label="收入" sign="+" amount={w.income} />
      <Row label="老師分潤" sign="−" amount={w.teachers} />
      <Row label="場地" sign="−" amount={w.venues} />
      {show(w.unallocated) && (
        <Row label="還沒分帳" tip="有課沒設分帳規則，這些錢還不知道要給誰。" sign="−" amount={w.unallocated} />
      )}
      <Row label="進公積金" sign="=" amount={w.fund} />
      {show(w.other) && (
        <Row
          label="過期收入與調整"
          tip="課卡過期留下的錢、結算後才補的點名或收款、發錢時取整的零頭。"
          sign={w.other >= 0 ? "+" : "−"}
          amount={w.other}
        />
      )}
      <Row label="支出" sign="−" amount={w.expenses} />
      <Row label="本月淨變化" sign="=" amount={w.net} strong />
    </ul>
  );
}
