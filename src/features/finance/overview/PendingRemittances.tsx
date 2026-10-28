"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import EmptyState from "@/components/EmptyState";
import {
  useConfirmRemittanceMutation,
  useRejectRemittanceMutation,
  type Remittance,
} from "@/store/slices/finance";
import { daysSince } from "@/domains/finance/money";
import { Panel } from "../ui";
import ReasonDialog from "../ReasonDialog";
import { dayLabel, errorText, money } from "../format";

/** 轉交中的繳回。只有營收負責人看得到「收到了／金額不對」，其他人看同一張、沒有按鈕。 */
export default function PendingRemittances({ pending, ownerName, isRevenueOwner }: { pending: Remittance[]; ownerName: string; isRevenueOwner: boolean }) {
  const [confirm, confirming] = useConfirmRemittanceMutation();
  const [reject] = useRejectRemittanceMutation();
  const [rejecting, setRejecting] = useState<Remittance | null>(null);

  const onConfirm = async (r: Remittance) => {
    try {
      await confirm(r.id).unwrap();
      toast.success(`${money(r.amount)} 入庫了`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Panel title={isRevenueOwner ? "等你確認" : `等 ${ownerName} 確認`}>
      {pending.length === 0 ? (
        <EmptyState kind="inline" icon={<Truck />} title="沒有轉交中的錢" description="有人按「送回主堡」就會出現在這裡" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200">
          {pending.map((r) => {
            const waited = daysSince(new Date(r.createdAt));
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-neutral-900">
                    {r.from.name} 送來 <span className="tabular-nums">{money(r.amount)}</span>
                  </span>
                  <span className="text-[13px] text-neutral-500">
                    {dayLabel(r.sentOn)} · {r.method === "CASH" ? "現金" : `轉帳${r.reference ? ` 末五碼 ${r.reference}` : ""}`}
                    {r.note && ` · ${r.note}`}
                  </span>
                </div>
                <StatusTag tone={waited >= 3 ? "danger" : "warning"}>{waited === 0 ? "今天送出" : `等了 ${waited} 天`}</StatusTag>
                {isRevenueOwner && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onConfirm(r)} isLoading={confirming.isLoading && confirming.originalArgs === r.id}>
                      收到了
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRejecting(r)}>
                      金額不對
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ReasonDialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="金額不對，退回去"
        description={rejecting ? `${rejecting.from.name} 會收到通知，改好再送一次。` : undefined}
        label="哪裡不對"
        confirmLabel="退回"
        onConfirm={(reason) => reject({ id: rejecting!.id, reason }).unwrap()}
      />
    </Panel>
  );
}
