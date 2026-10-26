"use client";

import { useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useGetUnpaidStudentCardsQuery } from "@/store/slices/students";
import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import ConfirmPaymentDrawer, {
  ConfirmPaymentTarget,
} from "@/features/students/ConfirmPaymentDrawer";

export default function UnpaidTab() {
  const { data: cards, isLoading } = useGetUnpaidStudentCardsQuery();
  const [paying, setPaying] = useState<ConfirmPaymentTarget | null>(null);

  if (isLoading) {
    return (
      <div
        className="border border-neutral-200 rounded-2xl bg-white overflow-hidden"
        aria-busy="true"
        aria-label="載入未付款清單中"
      >
        <div className="divide-y divide-neutral-200">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="w-20 shrink-0 h-3.5" />
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="shrink-0 h-5 w-14" />
              <Skeleton className="shrink-0 h-9 w-[104px] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <EmptyState
        kind="inline"
        icon={<CircleDollarSign />}
        title="沒有未付款的課卡"
        description="所有課卡都已收款。"
      />
    );
  }

  return (
    <div className="border border-neutral-200 rounded-2xl bg-white overflow-hidden">
      <div className="divide-y divide-neutral-200">
        {cards.map((card) => (
          <div key={card.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-20 shrink-0 text-xs text-neutral-500">
              {formatDate(card.createdAt)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {card.student.name}
              </p>
              <p className="text-xs text-neutral-500 truncate">
                {card.card.name}
                {card.purchasedBy?.name ? ` · ${card.purchasedBy.name}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right text-base font-bold text-danger-700">
              ${formatMoney(card.finalPrice)}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={() =>
                setPaying({
                  studentId: card.studentId,
                  studentCardId: card.id,
                  studentName: card.student.name,
                  cardName: card.card.name,
                  serialNumber: card.serialNumber,
                  finalPrice: card.finalPrice,
                })
              }
            >
              <CircleDollarSign className="size-4" />
              <span>確認付款</span>
            </Button>
          </div>
        ))}
      </div>
      <ConfirmPaymentDrawer target={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
