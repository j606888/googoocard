"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { useGetUnpaidStudentCardsQuery } from "@/store/slices/students";
import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ConfirmPaymentDrawer, {
  ConfirmPaymentTarget,
} from "@/features/students/ConfirmPaymentDrawer";

/** 未付款課卡清單（收入頁抽屜的內容）：一列一張，右邊文字按鈕「確認付款」。 */
export default function UnpaidTab() {
  const { data: cards, isLoading } = useGetUnpaidStudentCardsQuery();
  const [paying, setPaying] = useState<ConfirmPaymentTarget | null>(null);

  if (isLoading) {
    return (
      <div className="divide-y divide-line" aria-busy="true" aria-label="載入未付款清單中">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return <p className="py-3 text-[15px] text-ink-3">所有課卡都已收款，沒有要追的錢。</p>;
  }

  const total = cards.reduce((sum, card) => sum + card.finalPrice, 0);

  return (
    <>
      <p className="mb-1 text-[13px] tabular-nums text-ink-3">
        {cards.length} 張 · 共 ${formatMoney(total)}
      </p>
      <ul className="divide-y divide-line border-b border-line">
        {cards.map((card) => (
          <li key={card.id} className="flex min-h-14 items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">{card.student.name}</p>
              <p className="truncate text-[13px] tabular-nums text-ink-3">
                {[formatDate(card.createdAt), card.card.name, card.purchasedBy?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
              ${formatMoney(card.finalPrice)}
            </span>
            <Button
              variant="text"
              size="sm"
              className="-mr-2 min-h-11 lg:min-h-9"
              aria-label={`確認付款：${card.student.name} ${card.card.name}`}
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
              確認付款
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmPaymentDrawer target={paying} onClose={() => setPaying(null)} />
    </>
  );
}
