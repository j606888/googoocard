"use client";

import { useState } from "react";
import type { StudentWithDetail } from "@/store/slices/students";
import { useGetCardsQuery } from "@/store/slices/cards";
import { formatMoney } from "@/lib/money";
import { BuyCardDialog, buyBlockedReason } from "./BuyCard";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { ChevronRight } from "lucide-react";

/** 快選最多列這麼多種常用卡。 */
const QUICK_PICK_COUNT = 4;

/**
 * 還沒有任何課卡時的課卡分頁：標題、常用卡種快選（點了直接開購買表單並預選）、
 * 「購買第一張課卡」。公開頁／LIFF 只有一句話。
 */
const EmptyCards = ({ student, isPublic = false }: { student: StudentWithDetail; isPublic?: boolean }) => {
  if (isPublic) {
    return <EmptyState kind="inline" title="目前沒有課卡" />;
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
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="m-0 text-[17px] font-semibold text-ink">{student.name}還沒有課卡</h3>
        <p className="m-0 mt-1 text-[13px] text-ink-3">
          買了卡才能扣堂數。選一張常用的直接開始，或打開完整的購買表單。
        </p>
      </div>
      {!archived && quickPicks.length > 0 && (
        <ul className="m-0 p-0 list-none divide-y divide-line border-y border-line">
          {quickPicks.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => openBuy(card.id)}
                className="-mx-3 flex min-h-13 w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-2 text-left cursor-pointer hover:bg-primary-50 outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{card.name}</span>
                  <span className="block truncate text-[13px] tabular-nums text-ink-3">
                    {[card.isPracticeCard ? "複習卡" : null, `${card.sessions} 堂`, `$${formatMoney(card.price)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!archived && (
        <div>
          <Button type="button" onClick={() => openBuy(null)}>
            ＋ 購買第一張課卡
          </Button>
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
