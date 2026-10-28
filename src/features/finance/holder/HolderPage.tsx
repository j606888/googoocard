"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMeQuery } from "@/store/slices/me";
import {
  useGetHolderPassbookQuery,
  useMarkFinanceQuestMutation,
  useWithdrawRemittanceMutation,
  type PassbookEntry,
  type Remittance,
  type RemittanceStatus,
} from "@/store/slices/finance";
import { Figure, Panel } from "../ui";
import { dayLabel, errorText, money } from "../format";
import RemitDialog from "./RemitDialog";

const STATUS: Record<RemittanceStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "轉交中", tone: "warning" },
  CONFIRMED: { label: "已入庫", tone: "positive" },
  REJECTED: { label: "被退回", tone: "danger" },
  WITHDRAWN: { label: "已撤回", tone: "neutral" },
};

/** 一位代收人的背包（存摺）。全公開：誰都看得到；只有本人能送回、改、撤回。 */
export default function HolderPage({ userId }: { userId: number }) {
  const { data, isLoading, isError } = useGetHolderPassbookQuery(userId);
  const { data: me } = useGetMeQuery();
  const [mark] = useMarkFinanceQuestMutation();
  const [withdraw] = useWithdrawRemittanceMutation();
  const [remitOpen, setRemitOpen] = useState(false);
  const [editing, setEditing] = useState<Remittance | null>(null);
  const isMe = me?.id === userId;

  // 只標一次：標記會讓整個水庫重抓，放在 data 的 effect 裡沒擋會一直循環。
  const marked = useRef(false);
  useEffect(() => {
    if (!isMe || !data || marked.current) return;
    marked.current = true;
    mark("viewedBackpack");
  }, [isMe, data, mark]);

  if (isError) return <EmptyState kind="inline" title="找不到這個人" />;
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl opacity-50" />
      </div>
    );
  }

  const { figures } = data;
  const ownerName = data.setting.revenueOwner?.name ?? "營收負責人";
  const canRemit = isMe && !data.isRevenueOwner;

  const onWithdraw = async (r: Remittance) => {
    try {
      await withdraw(r.id).unwrap();
      toast.success("撤回了，錢回到你的背包");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <Panel title={isMe ? "我的背包" : `${data.user.name} 的背包`}>
        {data.isRevenueOwner ? (
          <p className="text-sm text-neutral-600">{data.user.name} 是營收負責人，收的錢直接算進大水庫，沒有背包。</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Figure big label="手上" value={figures.inHand} hint={figures.overdue ? undefined : figures.inHand > 0 ? `最早一筆放了 ${figures.daysHeld} 天` : "全部送回了"} />
              {figures.overdue && <StatusTag tone="danger">{figures.daysHeld} 天沒繳</StatusTag>}
              {canRemit && (
                <Button size="lg" onClick={() => setRemitOpen(true)} disabled={figures.inHand <= 0}>
                  <Truck className="size-5" aria-hidden="true" />
                  送回主堡
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-neutral-200 pt-4">
              <Figure label="收了" value={figures.collected} hint={`${figures.cardCount} 張課卡${figures.opening ? "＋期初" : ""}`} />
              <Figure label="轉交中" value={figures.pending} tone={figures.pending > 0 ? "warning" : "default"} />
              <Figure label="已入庫" value={figures.confirmed} />
            </div>
          </>
        )}
      </Panel>

      <Panel title="明細">
        {data.entries.length === 0 ? (
          <EmptyState kind="inline" title="還沒有收過錢" description="課卡頁「確認收款」選你當收款人，就會記在這裡" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200">
            {data.entries.map((e, i) => (
              <Row key={`${e.kind}-${"id" in e ? e.id : "studentCardId" in e ? e.studentCardId : i}`} entry={e} isMe={isMe} onEdit={setEditing} onWithdraw={onWithdraw} />
            ))}
          </ul>
        )}
      </Panel>

      {remitOpen && <RemitDialog open onClose={() => setRemitOpen(false)} inHand={figures.inHand} ownerName={ownerName} />}
      {editing && <RemitDialog open onClose={() => setEditing(null)} inHand={figures.inHand} ownerName={ownerName} editing={editing} />}
    </div>
  );
}

function Row({ entry, isMe, onEdit, onWithdraw }: { entry: PassbookEntry; isMe: boolean; onEdit: (r: Remittance) => void; onWithdraw: (r: Remittance) => void }) {
  const amountCell = (amount: number, struck = false) => (
    <div className="flex w-28 shrink-0 flex-col items-end">
      <span className={`text-sm font-semibold tabular-nums ${struck ? "text-neutral-400 line-through" : amount < 0 ? "text-neutral-900" : "text-primary-900"}`}>
        {money(amount, { signed: true })}
      </span>
      <span className="text-xs tabular-nums text-neutral-500">餘 {money(entry.balance)}</span>
    </div>
  );

  if (entry.kind === "opening") {
    return (
      <li className="flex items-center gap-3 py-3">
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-neutral-900">期初代收</span>
          <span className="text-[13px] text-neutral-500">{dayLabel(entry.at)} · 啟用那天手上還沒交的</span>
        </div>
        {amountCell(entry.amount)}
      </li>
    );
  }
  if (entry.kind === "card") {
    return (
      <li className="flex items-center gap-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href={`/students/${entry.studentId}`} className="truncate text-sm font-semibold text-neutral-900 hover:underline">
            {entry.studentName} · {entry.cardName}
          </Link>
          <span className="text-[13px] text-neutral-500">
            {dayLabel(entry.paidAt)} · {entry.serial}
            {entry.method && ` · ${entry.method === "CASH" ? "現金" : "轉帳"}`}
          </span>
        </div>
        {amountCell(entry.amount)}
      </li>
    );
  }
  const status = STATUS[entry.status];
  const open = entry.status === "PENDING" || entry.status === "REJECTED";
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            送回主堡 <StatusTag tone={status.tone}>{status.label}</StatusTag>
          </span>
          <span className="text-[13px] text-neutral-500">
            {dayLabel(entry.sentOn)} · {entry.method === "CASH" ? "現金" : `轉帳${entry.reference ? ` 末五碼 ${entry.reference}` : ""}`}
            {entry.note && ` · ${entry.note}`}
            {entry.reviewedBy && entry.status === "CONFIRMED" && ` · ${entry.reviewedBy.name} 確認`}
          </span>
        </div>
        {amountCell(-entry.amount, entry.status === "REJECTED" || entry.status === "WITHDRAWN")}
      </div>
      {entry.status === "REJECTED" && entry.rejectReason && (
        <p className="rounded-xl bg-danger-50 px-3 py-2 text-[13px] text-danger-700">退回原因：{entry.rejectReason}</p>
      )}
      {isMe && open && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(entry)}>
            {entry.status === "REJECTED" ? "改完重送" : "修改"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onWithdraw(entry)}>
            撤回
          </Button>
        </div>
      )}
    </li>
  );
}
