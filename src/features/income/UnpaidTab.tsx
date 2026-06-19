"use client";

import { CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  useGetUnpaidStudentCardsQuery,
  useConfirmStudentCardPaymentMutation,
} from "@/store/slices/students";

export default function UnpaidTab() {
  const { data: cards, isLoading } = useGetUnpaidStudentCardsQuery();
  const [confirmPayment, { isLoading: isConfirming }] =
    useConfirmStudentCardPaymentMutation();

  const handleConfirm = async (studentId: number, studentCardId: number) => {
    try {
      await confirmPayment({ id: studentId, studentCardId }).unwrap();
      toast.success("已確認付款");
    } catch {
      toast.error("確認付款失敗");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-neutral-500 py-4">載入未付款清單中...</p>;
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 gap-3 bg-green-50 rounded-sm">
        <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full">
          <CircleDollarSign className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-lg font-bold">沒有未付款的課卡</p>
          <p className="text-sm text-neutral-500 text-center">所有課卡都已收款。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-sm bg-white overflow-hidden">
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
            <div className="shrink-0 text-right text-base font-bold text-danger-600">
              ${card.finalPrice}
            </div>
            <button
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium bg-green-600 text-white rounded-full px-3 py-1.5 cursor-pointer hover:bg-green-700 transition-colors disabled:opacity-50"
              disabled={isConfirming}
              onClick={() => handleConfirm(card.studentId, card.id)}
            >
              <CircleDollarSign className="w-3.5 h-3.5" />
              <span>確認付款</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
