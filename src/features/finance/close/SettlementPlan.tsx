"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import StatusTag from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import type { PlannedTransfer, SettlementLine } from "@/domains/finance/settlement";
import { cn } from "@/lib/utils";
import Money, { moneyText } from "../Money";
import { NeedsEditNotice, Panel, PanelTitle } from "../ui";

type Status = "pending" | "sent" | "received";

/** 「分潤 23,460 − 手上可抵 12,250」：planSettlement 給數字，這裡組字。 */
const breakdown = (t: PlannedTransfer) =>
  t.offset > 0 ? `分潤 ${moneyText(t.owed)} − 手上可抵 ${moneyText(t.offset)}` : `分潤 ${moneyText(t.owed)}`;

/** 結算建議 → 大水庫負責人核准 → 各執行者轉帳 → 收款人確認收到。系統只記錄，不動錢。 */
export default function SettlementPlan({
  lines,
  transfers,
  tankOwner,
  canEdit,
}: {
  lines: SettlementLine[];
  transfers: PlannedTransfer[];
  tankOwner: string;
  canEdit: boolean;
}) {
  const [approved, setApproved] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});

  const statusOf = (id: string) => status[id] ?? "pending";
  const sentCount = transfers.filter((t) => statusOf(t.id) !== "pending").length;
  const receivedCount = transfers.filter((t) => statusOf(t.id) === "received").length;
  const allDone = transfers.length > 0 && receivedCount === transfers.length;

  const executors = [...new Set(transfers.map((t) => t.executor))].sort((a, b) =>
    a === tankOwner ? -1 : b === tankOwner ? 1 : 0
  );
  const settled = lines.filter((line) => line.net === 0);

  const approve = () => {
    setApproved(true);
    toast.success(`（示意）${tankOwner}已核准`);
  };

  return (
    <Panel className="flex flex-col gap-3 p-4 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle>結算建議：誰轉給誰</PanelTitle>
        {approved ? <StatusTag tone="positive">{tankOwner}已核准</StatusTag> : <StatusTag tone="neutral">等{tankOwner}核准</StatusTag>}
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-500">
        每個人手上的錢先抵自己的分潤，只轉差額；不足由大水庫轉出，多的繳回大水庫。
      </p>

      {!approved && canEdit && <Button onClick={approve}>{tankOwner}核准這份清單</Button>}
      {!canEdit && <NeedsEditNotice action="核准發薪、登記轉帳" />}

      {executors.map((executor) => {
        const own = transfers.filter((t) => t.executor === executor);
        const total = own.reduce((sum, t) => sum + t.amount, 0);
        return (
          <div key={executor} className="flex flex-col border-t border-neutral-200 pt-3">
            <div className="flex items-baseline justify-between text-[13px] text-neutral-500">
              <span>{executor === tankOwner ? `${executor}要轉出` : `${executor}要繳回`}</span>
              <span className="tabular-nums">合計 {moneyText(total)}</span>
            </div>
            {own.map((t) => (
              <TransferRow
                key={t.id}
                transfer={t}
                status={statusOf(t.id)}
                approved={approved}
                canEdit={canEdit}
                reference={refs[t.id] ?? ""}
                onReference={(value) => setRefs({ ...refs, [t.id]: value })}
                onAdvance={(next) => setStatus({ ...status, [t.id]: next })}
              />
            ))}
          </div>
        );
      })}

      {settled.length > 0 && (
        <div className="border-t border-neutral-200 pt-3 text-[13px] text-neutral-500">
          不用轉：{settled.map((line) => `${line.name}（手上的錢剛好抵完）`).join("、")}
        </div>
      )}

      <div
        role="status"
        className={cn(
          "rounded-xl px-3.5 py-2.5 text-[13px]",
          allDone ? "bg-primary-100 font-medium text-primary-900" : "bg-neutral-50 text-neutral-600"
        )}
      >
        {allDone
          ? "全部確認收到，可以發月報。"
          : `已轉 ${sentCount} / ${transfers.length} · 已確認收到 ${receivedCount} / ${transfers.length}`}
      </div>
    </Panel>
  );
}

function TransferRow({
  transfer: t,
  status,
  approved,
  canEdit,
  reference,
  onReference,
  onAdvance,
}: {
  transfer: PlannedTransfer;
  status: Status;
  approved: boolean;
  canEdit: boolean;
  reference: string;
  onReference: (value: string) => void;
  onAdvance: (next: Status) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 py-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_auto] items-center gap-2 text-[15px] text-neutral-900">
        <span className="truncate">{t.from}</span>
        <ArrowRight aria-hidden="true" className="size-4 text-neutral-400" />
        <span className="truncate">{t.to}</span>
        <Money value={t.amount} className="font-semibold" />
      </div>
      <div className="text-[13px] text-neutral-500">{breakdown(t)}</div>

      {status === "pending" && canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={reference}
            onChange={(e) => onReference(e.target.value)}
            disabled={!approved}
            placeholder="末五碼／現金面交"
            aria-label={`${t.from} → ${t.to} 轉帳備註`}
            className={cn(fieldControlClass(), "h-9 min-w-0 flex-1 rounded-lg px-3 text-sm")}
          />
          <Button variant="secondary" size="sm" disabled={!approved} onClick={() => onAdvance("sent")}>
            {t.executor}：已轉
          </Button>
        </div>
      )}
      {status === "sent" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-primary-900">
            已轉{reference && ` · ${reference}`} · 等{t.confirmer}確認
          </span>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => onAdvance("received")}>
              {t.confirmer}：已收到
            </Button>
          )}
        </div>
      )}
      {status === "received" && (
        <div className="inline-flex items-center gap-1 text-[13px] font-medium text-primary-900">
          <Check className="size-3.5" aria-hidden="true" />
          {t.confirmer}已確認收到{reference && ` · ${reference}`}
        </div>
      )}
    </div>
  );
}
