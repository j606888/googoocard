import { useEffect, useMemo, useState } from "react";
import Drawer from "@/components/Drawer";
import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import InputField from "@/components/InputField";
import { useCreateStudentCardMutation } from "@/store/slices/students";
import { useGetCardsQuery } from "@/store/slices/cards";

const BuyCard = ({ student }: { student: Student }) => {
  const { data: cards } = useGetCardsQuery();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [paid, setPaid] = useState(true);
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

  const handleSelectCard = (cardId: number) => {
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
        paid,
      });
      setIsDrawerOpen(false);
    } 
  }

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
      <button className="w-full p-3 bg-primary-500 text-white rounded-sm font-semibold cursor-pointer hover:bg-primary-600" onClick={() => setIsDrawerOpen(true)}>
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
            {cardOptions?.map((card) => (
              <div
                key={card.id}
                className={`flex gap-2 items-center px-4 py-3 border-1 border-gray-200 rounded-sm ${
                  selectedCardId === card.id
                    ? "bg-primary-100 border-primary-500"
                    : ""
                }`}
                onClick={() => handleSelectCard(card.id)}
              >
                <RoundCheckbox isChecked={selectedCardId === card.id} />
                <p>{card.name}</p>
              </div>
            ))}
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
          <div className="flex flex-col gap-2 mb-8">
            <p className="font-medium">Do student paid yet?</p>
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 items-center">
                <RoundCheckbox
                  isChecked={paid}
                  onClick={() => setPaid(true)}
                />
                <p>Yes</p>
              </div>
              <div className="flex gap-2 items-center">
                <RoundCheckbox
                  isChecked={!paid}
                  onClick={() => setPaid(false)}
                />
                <p>No</p>
              </div>
            </div>
          </div>
        </>
      )}
      </Drawer>
    </>
  );
};

export default BuyCard;
