"use client";

import { useState } from "react";
import type { StudentWithDetail } from "@/store/slices/students";
import { useGetCardsQuery } from "@/store/slices/cards";
import { formatMoney } from "@/lib/money";
import { BuyCardDialog, buyBlockedReason } from "./BuyCard";

/** 快選最多列這麼多種常用卡。 */
const QUICK_PICK_COUNT = 4;

/**
 * 還沒有任何課卡時的課卡分頁：標題、常用卡種快選（點了直接開購買表單並預選）、
 * 「購買第一張課卡」。公開頁／LIFF 只有一句話。
 */
const EmptyCards = ({ student, isPublic = false }: { student: StudentWithDetail; isPublic?: boolean }) => {
  if (isPublic) {
    return (
      <div className="w-full p-6 bg-primary-50 text-primary-700 text-center rounded-2xl text-sm">
        目前沒有課卡
      </div>
    );
  }
  return <TeacherEmptyCards student={student} />;
};

const TeacherEmptyCards = ({ student }: { student: StudentWithDetail }) => {
  const { data: cards } = useGetCardsQuery();
  const [buyOpen, setBuyOpen] = useState(false);
  const [initialCardId, setInitialCardId] = useState<number | null>(null);
  // 常用卡種：啟用中、這位學生買得了的，取前幾個（不符資格的複習卡不放進快選）。
  const quickPicks = (cards?.activeCards ?? [])
    .filter((card) => !buyBlockedReason(card, student))
    .slice(0, QUICK_PICK_COUNT);
  const archived = !!student.archivedAt;

  const openBuy = (cardId: number | null) => {
    setInitialCardId(cardId);
    setBuyOpen(true);
  };

  return (
    <section className="bg-white border border-neutral-200 rounded-2xl p-6 @md:p-8 flex flex-col gap-5">
      <div>
        <h3 className="m-0 text-lg @md:text-xl font-bold text-neutral-900">{student.name}還沒有課卡</h3>
        <p className="m-0 mt-1 text-sm text-neutral-600">
          買了卡才能扣堂數。選一張常用的直接開始，或打開完整的購買表單。
        </p>
      </div>
      {!archived && quickPicks.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
          {quickPicks.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => openBuy(card.id)}
              className="flex flex-col gap-1 p-3.5 rounded-xl border border-neutral-300 bg-white text-left cursor-pointer hover:border-primary-500 hover:bg-primary-50"
            >
              <span className="text-[15px] font-bold text-neutral-900 flex items-center gap-1.5 flex-wrap">
                {card.name}
                {card.isPracticeCard && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-100 text-warning-900">
                    複習
                  </span>
                )}
              </span>
              <span className="text-[13px] text-neutral-600 tabular-nums">
                {card.sessions} 堂 · ${formatMoney(card.price)}
              </span>
            </button>
          ))}
        </div>
      )}
      {!archived && (
        <div>
          <button
            type="button"
            onClick={() => openBuy(null)}
            className="h-12 px-5 rounded-xl bg-primary-900 text-white text-[15px] font-semibold cursor-pointer hover:bg-primary-700"
          >
            ＋ 購買第一張課卡
          </button>
        </div>
      )}
      <BuyCardDialog
        student={student}
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        initialCardId={initialCardId}
      />
    </section>
  );
};

export default EmptyCards;
