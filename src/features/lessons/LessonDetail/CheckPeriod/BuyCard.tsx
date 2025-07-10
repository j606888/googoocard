import { useEffect, useMemo, useState } from "react";
import Drawer from "@/components/Drawer";
import { MdAddCard } from "react-icons/md";
import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import InputField from "@/components/InputField";
import { useParams } from "next/navigation";
import { useGetLessonQuery } from "@/store/slices/lessons";
import { useCreateStudentCardMutation } from "@/store/slices/students";

const BuyCard = ({ student }: { student: Student }) => {
  const { id: lessonId } = useParams();
  const { data: lesson } = useGetLessonQuery(lessonId as string);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [paid, setPaid] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<{
    selectedCardId?: string;
    cardSessions?: string;
    paid?: string;
  }>({
    selectedCardId: "",
    cardSessions: "",
    paid: "",
  });
  const [createStudentCard, { isLoading }] = useCreateStudentCardMutation();

  const cardOptions = useMemo(() => {
    return lesson?.cards || [];
  }, [lesson]);

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

  const handleSubmit = async () => {
    let hasError = false;
    const newErrors = { ...errors };

    if (!selectedCardId) {
      newErrors.selectedCardId = "Please select a card";
      hasError = true;
    }

    if (!cardSessions) {
      newErrors.cardSessions = "Please enter card sessions";
      hasError = true;
    }

    if (paid === null) {
      newErrors.paid = "Required";
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    if (selectedCardId && paid !== null) {
      await createStudentCard({
        id: student.id,
        cardId: selectedCardId,
        sessions: parseInt(cardSessions),
        price: parseInt(cardPrice),
        paid,
      });
      setIsDrawerOpen(false);
    }
  };

  useEffect(() => {
    if (selectedCardId) {
      const card = cardOptions.find((card) => card.id === selectedCardId);
      if (card) {
        setCardSessions(card.sessions.toString());
        setCardPrice(card.price.toString());
      }
    }
  }, [selectedCardId, cardOptions]);

  return (
    <>
      <div
        className="ml-auto bg-[#F4A15E] rounded-full px-3 py-1 flex items-center gap-1"
        onClick={() => setIsDrawerOpen(true)}
      >
        <MdAddCard className="w-4.5 h-4.5 text-white" />
        <span className="text-sm font-medium text-white">Buy Card</span>
      </div>
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
            <div className="flex flex-col gap-2 mb-8">
              <p className="font-medium">Do student paid yet?</p>
              <div className="flex gap-4 items-center">
                <div className="flex gap-2 items-center">
                  <RoundCheckbox
                    isChecked={paid === true}
                    onClick={() => {
                      setPaid(true);
                      if (errors.paid) {
                        setErrors({ ...errors, paid: "" });
                      }
                    }}
                  />
                  <p>Yes</p>
                </div>
                <div className="flex gap-2 items-center">
                  <RoundCheckbox
                    isChecked={paid === false}
                    onClick={() => {
                      setPaid(false);
                      if (errors.paid) {
                        setErrors({ ...errors, paid: "" });
                      }
                    }}
                  />
                  <p>No</p>
                </div>
              </div>
              {errors.paid && (
                <p className="text-red-500 text-sm">{errors.paid}</p>
              )}
            </div>
          </>
        )}
      </Drawer>
    </>
  );
};

export default BuyCard;
