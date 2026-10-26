"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import LiffSkeleton from "@/features/liff/LiffSkeleton";
import { StudentWithDetail } from "@/store/slices/students";
import { LiffAuthContext } from "@/app/liff/LiffStudentGate";
import { canBuyCard } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { formatMoney } from "@/lib/money";
import { loadLiff } from "@/lib/liffClient";

interface BuyableCard {
  id: number;
  name: string;
  price: number;
  sessions: number;
  isPracticeCard: boolean;
  danceStyleId: number | null;
  danceStyle: DanceStyleSummary | null;
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
  // Set once a purchase succeeds → swaps the list for a final completion screen
  // so the student gets a clear ending instead of being left on a re-buyable list.
  const [purchased, setPurchased] = useState<BuyableCard | null>(null);
  // Whether the student arrived here via the check-in nudge (?from=checkin),
  // so the ending can acknowledge the self check-in too.
  const [fromCheckin, setFromCheckin] = useState(false);

  useEffect(() => {
    setFromCheckin(
      new URLSearchParams(window.location.search).get("from") === "checkin",
    );
  }, []);

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
    (card) => canBuyCard(card, student.danceLevels ?? {}).allowed,
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
      setPurchased(selected);
      setSelected(null);
    } catch (err) {
      console.error("[liff] buy card error", err);
      toast.error("購買失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  // Close the LIFF window in the LINE in-app browser; fall back to window.close()
  // for desktop/testing where the LIFF SDK isn't running in a client.
  const handleClose = async () => {
    try {
      const liff = await loadLiff();
      if (liff.isInClient()) {
        liff.closeWindow();
        return;
      }
    } catch (err) {
      console.error("[liff] close window error", err);
    }
    window.close();
  };

  if (loadError) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">
        載入失敗，請稍後再試。
      </p>
    );
  }

  if (!cards) {
    return <LiffSkeleton />;
  }

  // ----- Completion screen (the flow's ending) -----
  if (purchased) {
    return (
      <div className="flex flex-col gap-5 px-5 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-semibold">
            {fromCheckin ? "自助報到 & 購買課卡成功" : "購買課卡成功"}
          </h2>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{purchased.name}</span>
            {purchased.isPracticeCard && purchased.danceStyle && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${danceStyleMeta(purchased.danceStyle).badge}`}
              >
                {purchased.danceStyle.name}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
            <span>{purchased.sessions} 堂</span>
            <span className="text-lg font-bold text-primary-900">
              ${formatMoney(purchased.price)}
            </span>
          </div>
        </div>

        <p className="rounded-2xl bg-warning-50 p-4 text-sm leading-relaxed text-warning-950">
          待老師確認付款後，此課卡也會標記為已付款。卡片在確認付款前仍可正常使用，現在去上課吧！
        </p>

        <Button size="lg" onClick={handleClose} className="w-full">
          關閉視窗
        </Button>
      </div>
    );
  }

  return (
    <div className="px-5 py-5">
      {visibleCards.length === 0 ? (
        <EmptyState kind="page" title="目前沒有可購買的課卡。" />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelected(card)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4 text-left active:bg-neutral-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{card.name}</span>
                  {card.isPracticeCard && card.danceStyle && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${danceStyleMeta(card.danceStyle).badge}`}
                    >
                      {card.danceStyle.name}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-neutral-500">{card.sessions} 堂</div>
              </div>
              <div className="shrink-0 text-lg font-bold text-primary-900">
                ${formatMoney(card.price)}
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
            <div className="rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{selected.name}</span>
                {selected.isPracticeCard && selected.danceStyle && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${danceStyleMeta(selected.danceStyle).badge}`}
                  >
                    {selected.danceStyle.name}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
                <span>{selected.sessions} 堂</span>
                <span className="text-lg font-bold text-primary-900">
                  ${formatMoney(selected.price)}
                </span>
              </div>
            </div>
            <p className="rounded-2xl bg-warning-50 p-4 text-sm leading-relaxed text-warning-950">
              請直接轉帳或拿現金給老師，我們會再幫你把這張卡標記為已付款。卡片在確認付款前仍可正常使用。
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
