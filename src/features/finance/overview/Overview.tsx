"use client";

import Link from "next/link";
import { ChevronRight, CircleHelp } from "lucide-react";
import StatusTag from "@/components/StatusTag";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetFinanceOverviewQuery, useGetFinanceSettingQuery } from "@/store/slices/finance";
import { Figure, Panel } from "../ui";
import { dayLabel, money } from "../format";
import { financeHref } from "../routes";
import QuestPanel from "../quests/QuestPanel";
import PendingRemittances from "./PendingRemittances";

/** 總覽：公司的錢、等確認的繳回、每位代收人手上、不知道誰收的課卡。全公開。 */
export default function Overview() {
  const { data, isLoading } = useGetFinanceOverviewQuery();
  const { data: state } = useGetFinanceSettingQuery();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl opacity-50" />
        <Skeleton className="h-28 w-full rounded-2xl opacity-25" />
      </div>
    );
  }

  const { totals, setting } = data;
  const ownerName = setting.revenueOwner?.name ?? "營收負責人";
  const isRevenueOwner = Boolean(state?.isRevenueOwner);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex flex-col gap-4">
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Figure big label="公司的錢總共" value={totals.company} hint={`${dayLabel(setting.startDate)}開始記帳`} />
            <Link href={financeHref.vault} className="inline-flex items-center text-sm font-semibold text-primary-700">
              看大水庫 <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-3">
            <Figure label="大水庫" value={totals.vault} hint={`${ownerName} 保管`} />
            <Figure label="轉交中" value={totals.inTransit} tone={totals.inTransit > 0 ? "warning" : "default"} hint="等確認" />
            <Figure label="還在大家手上" value={totals.inHands} hint="還沒送回" />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-3">
            <Figure label="預收" value={totals.prepaid} hint={`學生付了、還沒上的 ${totals.prepaidSessions} 堂`} />
            <Figure label="其他" value={totals.other} hint="之後拆成待發、水庫基金" />
            {totals.ownerLoan !== null && (
              <Figure label="公司淨值" value={totals.netWorth} tone={totals.netWorth < 0 ? "danger" : "positive"} hint={`已扣建城貸款 ${money(totals.ownerLoan)}`} />
            )}
          </div>
        </Panel>

        <PendingRemittances pending={data.pending} ownerName={ownerName} isRevenueOwner={isRevenueOwner} />

        <Panel title="代收人背包">
          <ul className="flex flex-col divide-y divide-neutral-200">
            {setting.revenueOwner && (
              <li className="flex items-center gap-3 py-3 first:pt-0">
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-neutral-900">{ownerName} 自己收</span>
                  <span className="text-[13px] text-neutral-500">直接進大水庫 · {totals.ownerCardCount} 張課卡</span>
                </div>
                <span className="text-base font-bold tabular-nums text-neutral-900">{money(totals.ownerCollected)}</span>
              </li>
            )}
            {data.holders.map((h) => (
              <li key={h.user.id}>
                <Link href={financeHref.holder(h.user.id)} className="flex items-center gap-3 py-3 last:pb-0 hover:bg-neutral-50">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-neutral-900">
                      {h.user.name}
                      {!h.isMember && <span className="ml-1 font-normal text-neutral-500">（已離開）</span>}
                    </span>
                    <span className="text-[13px] text-neutral-500">
                      收了 {money(h.collected)} · 已繳回 {money(h.confirmed)}
                      {h.pending > 0 && ` · 轉交中 ${money(h.pending)}`}
                    </span>
                  </div>
                  {h.overdue && <StatusTag tone="danger">{h.daysHeld} 天沒繳</StatusTag>}
                  <div className="flex flex-col items-end">
                    <span className="text-base font-bold tabular-nums text-neutral-900">{money(h.inHand)}</span>
                    <span className="text-xs text-neutral-500">手上</span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {data.holders.length === 0 && (
            <EmptyState kind="inline" title="還沒有人代收" description="課卡頁「確認收款」選的收款人，收的錢就會出現在他的背包" />
          )}
        </Panel>

        {data.unknownCards.length > 0 && (
          <Panel title="不知道誰收的">
            <p className="text-sm leading-relaxed text-neutral-600">
              這些課卡付款時沒記到收款人，錢不知道在誰手上，所以沒算進公司的錢。問問看是誰收的。
            </p>
            <ul className="flex flex-col divide-y divide-neutral-200">
              {data.unknownCards.map((c) => (
                <li key={c.studentCardId}>
                  <Link href={`/students/${c.studentId}`} className="flex items-center gap-3 py-2.5 hover:bg-neutral-50">
                    <CircleHelp className="size-4 shrink-0 text-warning-950" aria-hidden="true" />
                    <span className="flex-1 text-sm text-neutral-900">
                      {c.studentName} · {c.cardName} <span className="text-neutral-500">{c.serial}</span>
                    </span>
                    <span className="text-[13px] text-neutral-500">{dayLabel(c.paidAt)}</span>
                    <span className="text-sm font-semibold tabular-nums">{money(c.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <QuestPanel />
    </div>
  );
}
