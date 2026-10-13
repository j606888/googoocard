import { useEffect, useMemo, useState } from "react";
import Drawer from "@/components/Drawer";
import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import InputField from "@/components/InputField";
import { Switch } from "@/components/ui/switch";
import { useCreateStudentCardMutation } from "@/store/slices/students";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { canBuyCard } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";

const BuyCard = ({
  student,
  variant = "block",
}: {
  student: Student;
  /**
   * "block"  —— 手機課卡分頁頂端的滿寬按鈕。
   * "header" —— 桌面學生頁首的動作按鈕群（滿寬大按鈕會搶走整個課卡區的焦點）。
   */
  variant?: "block" | "header";
}) => {
  const { data: cards } = useGetCardsQuery();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [isPaid, setIsPaid] = useState(true);
  const [errors, setErrors] = useState<{
    selectedCardId?: string;
    cardSessions?: string;
  }>({
    selectedCardId: "",
    cardSessions: "",
  });
  const [createStudentCard, { isLoading }] = useCreateStudentCardMutation();

  const cardOptions = useMemo(() => {
    return cards?.activeCards || [];
  }, [cards]);

  // No lesson context here — a practice card is only buyable when the student
  // is qualified for the card's own dance type.
  const buyBlockedReason = (card: Card): string | null => {
    const decision = canBuyCard(card, student.danceLevels ?? {});
    if (decision.allowed) return null;
    if (decision.reason === "NOT_QUALIFIED" && card.danceStyle) {
      return `未具備 ${card.danceStyle.name} 複習資格`;
    }
    return "複習卡未設定舞種，請先至課卡頁設定";
  };

  const handleSelectCard = (cardId: number) => {
    const card = cardOptions.find((c) => c.id === cardId);
    if (!card || buyBlockedReason(card)) {
      return;
    }
    setSelectedCardId(cardId);
    if (errors.selectedCardId) {
      setErrors({
        ...errors,
        selectedCardId: "",
      });
    }
  };

  const handleCardSessionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || parseInt(value) > 0) {
      setCardSessions(value);
      setErrors({
        ...errors,
        cardSessions: "",
      });
    }
  };

  const handleCardPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCardPrice(value);
  };

  const handleSubmit = () => {
    if (selectedCardId) {
      createStudentCard({
        id: student.id,
        cardId: selectedCardId,
        sessions: parseInt(cardSessions),
        price: parseInt(cardPrice),
        isPaid,
      });
      setIsDrawerOpen(false);
    }
  };

  useEffect(() => {
    if (selectedCardId) {
      const card = cards?.activeCards.find(
        (card) => card.id === selectedCardId
      );
      if (card) {
        setCardSessions(card.sessions.toString());
        setCardPrice(card.price.toString());
      }
    }
  }, [selectedCardId, cards]);

  return (
    <>
      <button
        className={
          variant === "header"
            ? "flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary-900 text-white text-sm font-semibold cursor-pointer hover:bg-primary-700"
            : "w-full p-3 bg-primary-500 text-white rounded-xl font-semibold cursor-pointer hover:bg-primary-600"
        }
        onClick={() => {
          setIsPaid(true);
          setIsDrawerOpen(true);
        }}
      >
        {variant === "header" ? "＋ 購買課卡" : "購買課卡"}
      </button>
      <Drawer
        title={`為 ${student.name} 買卡`}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        submitText="購買"
        isLoading={isLoading}
      >
        <div className="mb-4">
          <p>選擇課卡</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {cardOptions?.map((card) => {
              const blockedReason = buyBlockedReason(card);
              return (
                <div
                  key={card.id}
                  className={`flex flex-col gap-1 px-4 py-3 border-1 border-neutral-200 rounded-sm ${
                    blockedReason
                      ? "opacity-50 cursor-not-allowed bg-neutral-50"
                      : "cursor-pointer"
                  } ${
                    selectedCardId === card.id
                      ? "bg-primary-100 border-primary-500"
                      : ""
                  }`}
                  onClick={() => handleSelectCard(card.id)}
                >
                  <div className="flex gap-2 items-center">
                    <RoundCheckbox isChecked={selectedCardId === card.id} />
                    <p>{card.name}</p>
                    {card.isPracticeCard && card.danceStyle && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${danceStyleMeta(card.danceStyle).badge}`}
                      >
                        {card.danceStyle.name}
                      </span>
                    )}
                  </div>
                  {blockedReason && (
                    <p className="text-xs text-danger-500">{blockedReason}</p>
                  )}
                </div>
              );
            })}
            {errors.selectedCardId && (
              <p className="text-danger-500 text-sm">{errors.selectedCardId}</p>
            )}
          </div>
        </div>
        {selectedCardId && (
          <>
            <div className="mb-4">
              <InputField
                label="課卡堂數"
                value={cardSessions}
                onChange={handleCardSessionsChange}
                type="number"
                error={errors.cardSessions}
              />
            </div>
            <div className="mb-4">
              <InputField
                label="課卡金額"
                value={cardPrice}
                onChange={handleCardPriceChange}
                type="number"
              />
            </div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-700">已付款</span>
                <span className="text-xs text-neutral-400">
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

export default BuyCard;
