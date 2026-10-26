"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { StudentWithDetail } from "@/store/slices/students";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ConfirmPaymentDrawer from "../ConfirmPaymentDrawer";
import { attentionFor } from "./attention";

/**
 * 學生詳情頁首下方的一條提醒（右側抽屜與手機詳情頁共用）。
 * 需續約不放按鈕——頁首／課卡分頁本來就有「購買課卡」。
 * 桌面傳 `hideRenewal`：需續約已經由頁首數據列的紅字＋徽章講了，不再多一條。
 */
const AttentionBar = ({
  student,
  className,
  hideRenewal = false,
}: {
  student: StudentWithDetail;
  className?: string;
  hideRenewal?: boolean;
}) => {
  const [paying, setPaying] = useState(false);
  const attention = student.archivedAt ? null : attentionFor(student);
  if (!attention || (hideRenewal && attention.kind === "renewal")) return null;

  const tone =
    attention.kind === "idle"
      ? "border-warning-300 bg-warning-50 text-warning-950"
      : "border-danger-200 bg-danger-50 text-danger-700";
  const payCard = attention.kind === "unpaid" ? attention.card : null;

  return (
    <div className={className}>
      <div role="status" className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm", tone)}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="flex-1 font-semibold">{attention.message}</span>
        {payCard && (
          <Button type="button" size="sm" onClick={() => setPaying(true)}>
            確認收款
          </Button>
        )}
      </div>
      {payCard && (
        <ConfirmPaymentDrawer
          target={
            paying
              ? {
                  studentId: student.id,
                  studentCardId: payCard.id,
                  studentName: student.name,
                  cardName: payCard.card.name,
                  serialNumber: payCard.serialNumber,
                  finalPrice: payCard.finalPrice,
                }
              : null
          }
          onClose={() => setPaying(false)}
        />
      )}
    </div>
  );
};

export default AttentionBar;
