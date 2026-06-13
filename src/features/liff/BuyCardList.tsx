"use client";

import { useEffect, useState } from "react";
import { DanceType } from "@prisma/client";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { StudentWithDetail } from "@/store/slices/students";
import { LiffAuthContext } from "@/app/liff/LiffStudentGate";
import { canBuyCard } from "@/domains/qualification";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";

interface BuyableCard {
  id: number;
  name: string;
  price: number;
  sessions: number;
  isPracticeCard: boolean;
  danceType: DanceType | null;
}

// LIFF self-service card purchase. Lists the classroom's purchasable cards,
// hiding practice cards the student isn't qualified for, and on confirm creates
// an unpaid StudentCard the teacher reconciles later. Auth uses the LIFF ID
// token (plain fetch — RTK Query's base query doesn't carry the Bearer token).
export default function BuyCardList({
  student,
  auth,
}: {
  student: StudentWithDetail;
  auth: LiffAuthContext;
}) {
  const [cards, setCards] = useState<BuyableCard[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<BuyableCard | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/liff/cards?studentId=${auth.studentId}`, {
          headers: { Authorization: `Bearer ${auth.idToken}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data: BuyableCard[] = await res.json();
        if (!cancelled) setCards(data);
      } catch (err) {
        console.error("[liff] load cards error", err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.idToken, auth.studentId]);

  // Hide practice cards the student isn't qualified for (vs. teacher UI which
  // shows them disabled). General cards are always buyable.
  const visibleCards = (cards ?? []).filter(
    (card) => canBuyCard(card, student.danceQualifications ?? []).allowed,
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/liff/student-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.idToken}`,
        },
        body: JSON.stringify({ studentId: auth.studentId, cardId: selected.id }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success("購買成功，待老師確認付款");
      setSelected(null);
    } catch (err) {
      console.error("[liff] buy card error", err);
      toast.error("購買失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <p className="px-5 py-8 text-center text-sm text-gray-500">
        載入失敗，請稍後再試。
      </p>
    );
  }

  if (!cards) {
    return <ListSkeleton />;
  }

  return (
    <div className="px-5 py-5">
      {visibleCards.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          目前沒有可購買的課卡。
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelected(card)}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 text-left active:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{card.name}</span>
                  {card.isPracticeCard && card.danceType && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${DANCE_TYPE_META[card.danceType].badge}`}
                    >
                      {danceTypeLabel(card.danceType)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-500">{card.sessions} 堂</div>
              </div>
              <div className="shrink-0 text-lg font-bold text-primary-600">
                ${card.price}
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer
        title="確認購買"
        open={selected !== null}
        onClose={() => setSelected(null)}
        onSubmit={handleConfirm}
        submitText="確認購買"
        isLoading={submitting}
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{selected.name}</span>
                {selected.isPracticeCard && selected.danceType && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${DANCE_TYPE_META[selected.danceType].badge}`}
                  >
                    {danceTypeLabel(selected.danceType)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                <span>{selected.sessions} 堂</span>
                <span className="text-lg font-bold text-primary-600">
                  ${selected.price}
                </span>
              </div>
            </div>
            <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
              請直接轉帳或拿現金給老師，我們會再幫你把這張卡標記為已付款。卡片在確認付款前仍可正常使用。
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
