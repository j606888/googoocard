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
 * 已經沒卡不放按鈕——頁首／課卡分頁本來就有「購買課卡」。
 * 未付款、已經沒卡要處理，用琥珀色條；有卡沒來只是提醒，一行淡字。
 */
const AttentionBar = ({
  student,
  className,
}: {
  student: StudentWithDetail;
  className?: string;
}) => {
  const [paying, setPaying] = useState(false);
  const attention = student.archivedAt ? null : attentionFor(student);
  if (!attention) return null;

  const needsAction = attention.kind !== "idle";
  const payCard = attention.kind === "unpaid" ? attention.card : null;

  return (
    <div className={className}>
      <div
        role="status"
        className={cn(
          "flex min-h-11 items-center gap-3 text-sm",
          needsAction ? "rounded-xl bg-warning-100 px-4 py-2 text-warning-950" : "text-ink-2"
        )}
      >
        <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn("flex-1", needsAction && "font-semibold")}>{attention.message}</span>
        {payCard && (
          <Button
            type="button"
            variant="text"
            size="sm"
            className="-mr-2 text-warning-950 hover:bg-warning-200/60 hover:text-warning-950"
            onClick={() => setPaying(true)}
          >
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
