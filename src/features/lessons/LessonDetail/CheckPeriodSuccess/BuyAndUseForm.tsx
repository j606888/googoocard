import Drawer from "@/components/Drawer";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { useEffect, useMemo, useState } from "react";
import InputField from "@/components/InputField";
import RoundCheckbox from "@/components/RoundCheckbox";
import { useCreateStudentCardMutation } from "@/store/slices/students";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { useParams } from "next/navigation";

const BuyAndUseForm = ({
  record,
  lesson,
  studentId,
}: {
  record: AttendanceRecord;
  lesson: Lesson;
  studentId: number;
}) => {
  const [open, setOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const { periodId } = useParams();

  const cardOptions = useMemo(() => {
    return lesson?.cards || [];
  }, [lesson]);
  const [createStudentCard, { isLoading }] = useCreateStudentCardMutation();
  const [consumeStudentCard] = useConsumeStudentCardMutation();
  const [errors, setErrors] = useState<{
    selectedCardId?: string;
    cardSessions?: string;
  }>({
    selectedCardId: "",
    cardSessions: "",
  });

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
    setCardSessions(e.target.value);
  };

  const handleCardPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardPrice(e.target.value);
  };

  const handleSubmit = async () => {
    if (selectedCardId) {
      const studentCard = await createStudentCard({
        id: record.studentId,
        cardId: selectedCardId,
        sessions: parseInt(cardSessions),
        price: parseInt(cardPrice),
      });
      if (studentCard?.data) {
        await consumeStudentCard({
          id: lesson.id,
          periodId: Number(periodId),
          studentId: studentId,
          studentCardId: studentCard.data.id,
        });
      }
      setOpen(false);
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
      <button
        className="text-xs rounded-full text-white bg-[#F87666] w-25 px-3 py-2 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        買卡並使用
      </button>
      <Drawer
        title={`為 ${record.studentName} 買卡並使用`}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitText="買卡並使用"
        isLoading={isLoading}
        disabled={!selectedCardId || !cardSessions || !cardPrice}
      >
        <div className="mb-4">
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
          </>
        )}
      </Drawer>
    </>
  );
};

export default BuyAndUseForm;
