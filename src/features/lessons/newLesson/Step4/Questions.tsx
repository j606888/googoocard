import { useState, useEffect } from "react";
import Image from "next/image";
import { Student } from "@/store/slices/students";
import InputField from "@/components/InputField";
import RoundCheckbox from "@/components/RoundCheckbox";
import { useGetCardsQuery } from "@/store/slices/cards";
import Button from "@/components/Button";

export type Answer = {
  studentId: number;
  createNewCard: boolean;
  selectedCardId: number | null;
  cardSessions: string;
  cardPrice: string;
};
const Questions = ({
  student,
  defaultAnswers = {
    studentId: 0,
    createNewCard: true,
    selectedCardId: null,
    cardSessions: "",
    cardPrice: "",
  },
  onSubmit = () => {},
  onBack = () => {},
}: {
  student: Student;
  defaultAnswers?: Answer;
  onSubmit?: (answers: Answer) => void;
  onBack?: () => void;
}) => {
  const { data: cards } = useGetCardsQuery();
  const [createNewCard, setCreateNewCard] = useState<boolean>(
    defaultAnswers?.createNewCard || true
  );
  const [selectedCardId, setSelectedCardId] = useState<number | null>(
    defaultAnswers?.selectedCardId || null
  );
  const [cardSessions, setCardSessions] = useState<string>(
    defaultAnswers?.cardSessions || ""
  );
  const [cardPrice, setCardPrice] = useState<string>(
    defaultAnswers?.cardPrice || ""
  );
  const hasExistingCard = false;

  const handleSelectCard = (cardId: number) => {
    setSelectedCardId(cardId);
  };

  const handleSubmit = () => {
    onSubmit({
      studentId: student.id,
      createNewCard,
      selectedCardId,
      cardSessions,
      cardPrice,
    });
  };

  useEffect(() => {
    if (!defaultAnswers.selectedCardId && selectedCardId) {
      const card = cards?.activeCards.find(
        (card) => card.id === selectedCardId
      );
      if (card) {
        setCardSessions(card.sessions.toString());
        setCardPrice(card.price.toString());
      }
    }
  }, [selectedCardId, cards, defaultAnswers.selectedCardId]);

  useEffect(() => {
    if (!defaultAnswers.selectedCardId) {
      setSelectedCardId(cards?.activeCards[0].id || null);
    }
  }, [cards, defaultAnswers.selectedCardId]);

  return (
    <div className="border-t-1 border-gray-200 mt-3 pt-3 mb-10">
      <div className="flex items-center gap-2 mb-2">
        <Image
          src={student.avatarUrl}
          alt={student.name}
          width={40}
          height={40}
          className="rounded-full"
        />
        <p className="text-lg font-semibold">{student.name}</p>
      </div>
      <div className="mb-4">
        <div className="flex  flex-col gap-2 mb-4">
          <p>Assign new card?</p>
          <div className="flex gap-2 items-center">
            <RoundCheckbox
              isChecked={!createNewCard}
              onClick={() => setCreateNewCard(false)}
              disabled={!hasExistingCard}
            />
            <p className={`${!hasExistingCard ? "text-gray-300" : ""}`}>
              No, use existing card
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <RoundCheckbox
              isChecked={createNewCard}
              onClick={() => setCreateNewCard(true)}
            />
            <p>Yes, assign a new one</p>
          </div>
        </div>
        {createNewCard && (
          <>
            <p>Choose card</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {cards?.activeCards.map((card) => (
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
            </div>
          </>
        )}
      </div>
      {selectedCardId && (
        <>
          <div className="mb-4">
            <InputField
              label="Card sessions"
              value={cardSessions}
              onChange={(e) => setCardSessions(e.target.value)}
              type="number"
            />
          </div>
          <div className="mb-4">
            <InputField
              label="Card Price"
              value={cardPrice}
              onChange={(e) => setCardPrice(e.target.value)}
              type="number"
            />
          </div>
        </>
      )}
      <div className="flex flex-col gap-3">
        <Button outline onClick={onBack}>
          Back to previous student
        </Button>
        <Button onClick={handleSubmit}>Go to next student</Button>
      </div>
    </div>
  );
};

export default Questions;
