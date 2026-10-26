"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DataView, { type DataViewColumn } from "@/components/DataView";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import FinancePageHeader from "../FinancePageHeader";
import Money, { moneyText } from "../Money";
import { branchPools, inTransit, poolMovements } from "../mockData";
import { financeHref } from "../routes";
import type { PoolMovement } from "../types";
import { PanelTitle } from "../ui";
import HolderList from "./HolderList";
import { overThreshold, remittable, withRunningBalance } from "./poolMath";

type MovementRow = PoolMovement & { balance: number };

const MOVEMENT_COLUMNS: DataViewColumn<MovementRow>[] = [
  {
    key: "item",
    header: "項目",
    width: "minmax(0,2fr)",
    role: "primary",
    render: (m) => (
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-neutral-900 lg:text-[15px]">
        {m.internal && <StatusTag tone="neutral">內部移轉</StatusTag>}
        <span className="truncate">{m.item}</span>
      </span>
    ),
  },
  { key: "date", header: "日期", width: "64px", render: (m) => <span className="tabular-nums">{m.date}</span> },
  { key: "by", header: "經手人", width: "minmax(0,1fr)", render: (m) => m.by },
  {
    key: "balance",
    header: "之後餘額",
    width: "96px",
    mobileLabel: "餘額",
    render: (m) => <Money value={m.balance} className="lg:ml-auto" />,
  },
  {
    key: "amount",
    header: "金額",
    width: "96px",
    role: "trailing",
    render: (m) =>
      m.internal ? (
        <Money value={m.amount} className="ml-auto text-sm text-neutral-500 lg:text-[15px]" />
      ) : (
        <Money value={m.amount} sign colored className="ml-auto text-sm font-semibold lg:text-[15px]" />
      ),
  },
];

/** 單一小水庫：餘額／零用金／可繳回、現金在誰手上、上次繳回後的進出。 */
export default function PoolDetail({ poolId }: { poolId: string }) {
  const canEdit = useCan("finance.edit");
  const pool = branchPools.find((p) => p.id === poolId);

  if (!pool) {
    return (
      <EmptyState
        title="找不到這個小水庫"
        description="可能已經改名或移除了，回資金頁看全部的小水庫。"
        action={
          <Button asChild>
            <Link href={financeHref("funds")}>回資金與繳回</Link>
          </Button>
        }
      />
    );
  }

  const canRemit = remittable(pool);
  const alert = overThreshold(pool);
  const remitPending = inTransit.some((r) => r.poolId === pool.id);
  const movements = withRunningBalance(poolMovements[pool.id] ?? [], pool.balance);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        crumbs={[{ label: "資金與繳回", href: financeHref("funds") }]}
        title={pool.name}
        description={`保管人 ${pool.keeper} · 上次繳回 ${pool.lastRemit.date} · ${moneyText(pool.lastRemit.amount)}${remitPending ? "（等確認）" : ""}`}
        actions={
          canEdit && (
            <Button asChild>
              <Link href={financeHref("remit", pool.id)}>
                繳回大水庫
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )
        }
      />

      <section aria-label="小水庫水位" className="grid gap-3 sm:grid-cols-3 lg:gap-4">
        <FigureCard label="目前餘額" value={pool.balance} note={`上次繳回後 ${pool.lastRemit.daysAgo} 天`} />
        <FigureCard label="保留零用金" value={pool.reserve} note="付場租、買飲料用" muted />
        <FigureCard
          label="可繳回"
          value={canRemit}
          note={alert ? `已超過 ${moneyText(pool.alertThreshold)}，建議近期繳回` : "還沒到提醒門檻"}
          highlight
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <HolderList keeper={pool.keeper} holders={pool.holders} canEdit={canEdit} />

        <section aria-label="上次繳回後的進出" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <PanelTitle>上次繳回後的進出</PanelTitle>
            <Button variant="link" asChild className="text-sm">
              <Link href={financeHref("ledger")}>看全部流水帳</Link>
            </Button>
          </div>
          {movements.length > 0 ? (
            <DataView
              columns={MOVEMENT_COLUMNS}
              rows={movements}
              rowKey={(m) => m.id}
              rowClassName={(m) => (m.internal ? "bg-neutral-50" : undefined)}
            />
          ) : (
            <EmptyState kind="inline" title="上次繳回後還沒有進出" />
          )}
        </section>
      </div>
    </div>
  );
}

function FigureCard({
  label,
  value,
  note,
  muted,
  highlight,
}: {
  label: string;
  value: number;
  note: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 lg:p-5",
        highlight ? "border-primary-700 bg-primary-50 ring-1 ring-primary-700" : "border-neutral-200 bg-white"
      )}
    >
      <div className={cn("text-sm", highlight ? "text-primary-900" : "text-neutral-500")}>{label}</div>
      <Money
        value={value}
        className={cn(
          "mt-1 block text-[28px] font-semibold lg:text-[32px]",
          highlight ? "text-primary-900" : muted ? "text-neutral-500" : "text-neutral-900"
        )}
      />
      <div className={cn("mt-1 text-[13px]", highlight ? "text-primary-900" : "text-neutral-500")}>{note}</div>
    </div>
  );
}
