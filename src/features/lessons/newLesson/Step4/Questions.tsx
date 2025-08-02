import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Student, useGetStudentCardsQuery } from "@/store/slices/students";
import InputField from "@/components/InputField";
import RoundCheckbox from "@/components/RoundCheckbox";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { Answer } from "@/store/slices/lessons";

const validationErrors = {
  selectedCardId: "Must select a card",
  nonZero: "Must be greater than 0",
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
}: {
  student: Student;
  defaultAnswers?: Answer;
  onSubmit?: (answers: Answer) => void;
}) => {
  const { data: cards } = useGetCardsQuery();
  const { data: studentCards } = useGetStudentCardsQuery({ id: student.id });
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
  const [errors, setErrors] = useState<{
    selectedCardId?: string;
    cardSessions?: string;
  }>({
    selectedCardId: "",
    cardSessions: "",
  });

  const cardOptions = useMemo(() => {
    if (!cards) return [];

    const activeCards = cards?.activeCards || [];
    const lessonDraft = localStorage.getItem("lesson-draft") || "{}";
    const cardIds = JSON.parse(lessonDraft).cardIds || [];

    return cardIds.map((cardId: number) => {
      return activeCards.find((card) => card.id === cardId);
    }) as Card[];
  }, [cards]);

  const hasExistingCard = useMemo(() => {
    const usableCards =
      studentCards?.filter((card) => card.remainingSessions > 0) || [];
    const usableCardIds = usableCards.map((card) => card.cardId) || [];

    const lessonDraft = JSON.parse(
      localStorage.getItem("lesson-draft") || "{}"
    );
    const cardIds = lessonDraft.cardIds || [];
    return cardIds.some((cardId: number) => usableCardIds.includes(cardId));
  }, [studentCards]);

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
    const errors = validateForm({
      createNewCard,
      selectedCardId,
      cardSessions,
      cardPrice,
    });
    setErrors(errors);
    if (Object.keys(errors).length > 0) return;
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
          <div className="flex gap-6">
            <div className="flex gap-2 items-center">
              <RoundCheckbox
                isChecked={createNewCard}
                onClick={() => setCreateNewCard(true)}
              />
              <p>Yes</p>
            </div>
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
          </div>
        </div>
        {createNewCard && (
          <>
            <p>Choose card</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {cardOptions?.map((card) => (
                <div
                  key={card.id}
                  className={`flex gap-2 items-center px-4 py-3 border-1 border-gray-200 rounded-sm cursor-pointer ${
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
          </>
        )}
      </div>
      {selectedCardId && (
        <div className="flex gap-3">
          <div className="mb-4">
            <InputField
              label="Card Price"
              value={cardPrice}
              onChange={handleCardPriceChange}
              type="number"
            />
          </div>
          <div className="mb-4">
            <InputField
              label="Card sessions"
              value={cardSessions}
              onChange={handleCardSessionsChange}
              type="number"
              error={errors.cardSessions}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button onClick={handleSubmit}>Save & Next</Button>
      </div>
    </div>
  );
};

const Button = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => {
  return (
    <button
      className="w-full border font-semibold py-2 rounded-sm  bg-primary-500 text-white cursor-pointer hover:bg-primary-600"
      onClick={onClick}
    >
      {children}
    </button>
  );
};
const validateForm = (data: {
  createNewCard: boolean;
  selectedCardId: number | null;
  cardSessions: string;
  cardPrice: string;
}) => {
  const errors: {
    selectedCardId?: string;
    cardSessions?: string;
    cardPrice?: string;
  } = {};

  if (!data.createNewCard) {
    return errors;
  }

  if (!data.selectedCardId) {
    errors.selectedCardId = validationErrors.selectedCardId;
    return errors;
  }
  if (!data.cardSessions || parseInt(data.cardSessions) <= 0) {
    errors.cardSessions = validationErrors.nonZero;
  }

  return errors;
};
export default Questions;
