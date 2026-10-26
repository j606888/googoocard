"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Drawer from "@/components/Drawer";
import RoundCheckbox from "@/components/RoundCheckbox";
import InputField from "@/components/InputField";
import { Switch } from "@/components/ui/switch";
import { useGetLessonQuery } from "@/store/slices/lessons";
import { useCreateStudentCardMutation } from "@/store/slices/students";
import { canBuyCard, type DanceLevels } from "@/domains/qualification";
import { practiceCardBlockedHint } from "@/lib/danceLevels";
import type { Card } from "@/store/slices/cards";
import { FieldError, FieldLabel } from "@/components/Field";

/**
 * Buy a card for a student without leaving the lesson page.
 *
 * Grew out of `PeriodAttendanceForm/BuyCard.tsx`, which had been dead for a
 * while (no importers) and — unlike the other two buy surfaces,
 * `StudentDetail/CardsSection/BuyCard` and `CheckPeriodSuccess/BuyAndUseForm` —
 * never applied `canBuyCard`. Since the attention list now funnels teachers
 * here, the qualification block came with it: without it the flow would be
 * "buy card → pick the practice card → API 403", for exactly the students whose
 * card situation was flagged.
 */
const BuyCardDrawer = ({
  student,
  trigger,
}: {
  student: { id: number; name: string; danceLevels?: DanceLevels };
  trigger: (open: () => void) => React.ReactNode;
}) => {
  const { id: lessonId } = useParams();
  const { data: lesson } = useGetLessonQuery(lessonId as string);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [isPaid, setIsPaid] = useState(true);
  const [errors, setErrors] = useState<{
    selectedCardId?: string;
    cardSessions?: string;
  }>({});
  const [createStudentCard, { isLoading }] = useCreateStudentCardMutation();

  const cardOptions = useMemo(() => lesson?.cards ?? [], [lesson]);
  const qualifications = useMemo(
    () => student.danceLevels ?? {},
    [student.danceLevels]
  );

  const forbiddenHint = (card: Card) => {
    if (!lesson) return null;
    if (canBuyCard(card, qualifications, lesson).allowed) return null;
    return practiceCardBlockedHint(card, lesson);
  };

  const handleSelectCard = (card: Card) => {
    if (forbiddenHint(card)) return;
    setSelectedCardId(card.id);
    setErrors((prev) => ({ ...prev, selectedCardId: undefined }));
  };

  useEffect(() => {
    if (selectedCardId === null) return;
    const card = cardOptions.find((c) => c.id === selectedCardId);
    if (card) {
      setCardSessions(card.sessions.toString());
      setCardPrice(card.price.toString());
    }
  }, [selectedCardId, cardOptions]);

  const openDrawer = () => {
    setIsPaid(true);
    setSelectedCardId(null);
    setErrors({});
    setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!selectedCardId) nextErrors.selectedCardId = "請選擇課卡";
    if (!cardSessions || parseInt(cardSessions) <= 0) {
      nextErrors.cardSessions = "請輸入堂數";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await createStudentCard({
      id: student.id,
      cardId: selectedCardId!,
      sessions: parseInt(cardSessions),
      price: parseInt(cardPrice || "0"),
      lessonId: Number(lessonId),
      isPaid,
    });
    setIsDrawerOpen(false);
  };

  return (
    <>
      {trigger(openDrawer)}
      <Drawer
        title={`為 ${student.name} 買卡`}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        submitText="購買"
        isLoading={isLoading}
      >
        <div className="mb-4">
          <p className="text-sm font-medium text-neutral-900 mb-2">選擇課卡</p>
          <div className="flex flex-wrap gap-2">
            {cardOptions.map((card) => {
              const hint = forbiddenHint(card);
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={Boolean(hint)}
                  onClick={() => handleSelectCard(card)}
                  className={`flex flex-col items-start gap-1 px-4 py-3 border rounded-xl text-left ${
                    hint
                      ? "border-neutral-200 opacity-50 cursor-not-allowed"
                      : selectedCardId === card.id
                      ? "bg-primary-100 border-primary-700 cursor-pointer"
                      : "border-neutral-200 cursor-pointer hover:border-neutral-300"
                  }`}
                >
                  <span className="flex gap-2 items-center">
                    <RoundCheckbox isChecked={selectedCardId === card.id} />
                    <span>{card.name}</span>
                  </span>
                  {hint && (
                    <span className="text-xs text-danger-700 pl-7">{hint}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2">
            <FieldError>{errors.selectedCardId}</FieldError>
          </div>
        </div>

        {selectedCardId && (
          <>
            <div className="flex gap-3">
              <div className="mb-4">
                <InputField
                  label="課卡金額"
                  value={cardPrice}
                  onChange={(e) => setCardPrice(e.target.value)}
                  type="number"
                />
              </div>
              <div className="mb-4">
                <InputField
                  label="課卡堂數"
                  value={cardSessions}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || parseInt(value) > 0) {
                      setCardSessions(value);
                      setErrors((prev) => ({ ...prev, cardSessions: undefined }));
                    }
                  }}
                  type="number"
                  error={errors.cardSessions}
                />
              </div>
            </div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col">
                <FieldLabel>已付款</FieldLabel>
                <span className="text-xs text-neutral-500">
                  {isPaid ? "已收到款項" : "尚未付款，卡片仍可使用"}
                </span>
              </div>
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
            </div>
          </>
        )}
      </Drawer>
    </>
  );
};

export default BuyCardDrawer;
