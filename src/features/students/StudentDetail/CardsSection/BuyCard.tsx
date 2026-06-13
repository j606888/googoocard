import { useEffect, useMemo, useState } from "react";
import Drawer from "@/components/Drawer";
import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import InputField from "@/components/InputField";
import { Switch } from "@/components/ui/switch";
import { useCreateStudentCardMutation } from "@/store/slices/students";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { canBuyCard } from "@/domains/qualification";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";

const BuyCard = ({ student }: { student: Student }) => {
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
    const decision = canBuyCard(card, student.danceQualifications ?? []);
    if (decision.allowed) return null;
    if (decision.reason === "NOT_QUALIFIED" && card.danceType) {
      return `未具備 ${danceTypeLabel(card.danceType)} 複習資格`;
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
        className="w-full p-3 bg-primary-500 text-white rounded-sm font-semibold cursor-pointer hover:bg-primary-600"
        onClick={() => {
          setIsPaid(true);
          setIsDrawerOpen(true);
        }}
      >
        BUY NEW CARD
      </button>
      <Drawer
        title={`Buy Card for ${student.name}`}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        submitText="Buy"
        isLoading={isLoading}
      >
        <div className="mb-4">
          <p>Choose card</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {cardOptions?.map((card) => {
              const blockedReason = buyBlockedReason(card);
              return (
                <div
                  key={card.id}
                  className={`flex flex-col gap-1 px-4 py-3 border-1 border-gray-200 rounded-sm ${
                    blockedReason
                      ? "opacity-50 cursor-not-allowed bg-gray-50"
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
                    {card.isPracticeCard && card.danceType && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${DANCE_TYPE_META[card.danceType].badge}`}
                      >
                        {danceTypeLabel(card.danceType)}
                      </span>
                    )}
                  </div>
                  {blockedReason && (
                    <p className="text-xs text-red-500">{blockedReason}</p>
                  )}
                </div>
              );
            })}
            {errors.selectedCardId && (
              <p className="text-red-500 text-sm">{errors.selectedCardId}</p>
            )}
          </div>
        </div>
        {selectedCardId && (
          <>
            <div className="mb-4">
              <InputField
                label="Card sessions"
                value={cardSessions}
                onChange={handleCardSessionsChange}
                type="number"
                error={errors.cardSessions}
              />
            </div>
            <div className="mb-4">
              <InputField
                label="Card Price"
                value={cardPrice}
                onChange={handleCardPriceChange}
                type="number"
              />
            </div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">已付款</span>
                <span className="text-xs text-gray-400">
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
