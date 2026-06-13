import Drawer from "@/components/Drawer";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { useEffect, useMemo, useState } from "react";
import InputField from "@/components/InputField";
import RoundCheckbox from "@/components/RoundCheckbox";
import { Switch } from "@/components/ui/switch";
import { useCreateStudentCardMutation, useGetStudentQuery } from "@/store/slices/students";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { canBuyCard, requiredDanceTypeFor } from "@/domains/qualification";
import { danceTypeLabel } from "@/lib/danceTypes";
import { Card } from "@/store/slices/cards";

const BuyAndUseForm = ({
  record,
  lesson,
  studentId,
}: {
  record: AttendanceRecord;
  lesson: Lesson;
  studentId: number;
}) => {
  const { data: student } = useGetStudentQuery({ id: studentId });
  const [open, setOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [allowManualOverride, setAllowManualOverride] = useState(false);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [isPaid, setIsPaid] = useState(true);
  const { periodId } = useParams();

  const cardOptions = useMemo(() => {
    return lesson?.cards || [];
  }, [lesson]);
  const [createStudentCard, { isLoading }] = useCreateStudentCardMutation();
  const [consumeStudentCard, { isLoading: isConsumeLoading }] = useConsumeStudentCardMutation();
  const [errors, setErrors] = useState<{
    selectedCardId?: string;
    cardSessions?: string;
  }>({
    selectedCardId: "",
    cardSessions: "",
  });

  const qualifications = useMemo(
    () => student?.danceQualifications ?? [],
    [student]
  );

  // Practice card the student is not qualified for — hard block.
  const isCardForbidden = (card: Card) =>
    !canBuyCard(card, qualifications, lesson.danceType).allowed;

  // The lesson offers a practice card this student can buy — lock general
  // cards by default so the student's benefit isn't wasted on a pricier card.
  const shouldLockGeneralCards = useMemo(
    () =>
      cardOptions.some(
        (card) =>
          card.isPracticeCard &&
          canBuyCard(card, qualifications, lesson.danceType).allowed
      ) && !allowManualOverride,
    [cardOptions, qualifications, lesson.danceType, allowManualOverride]
  );

  const isCardDisabled = (card: Card) => {
    if (isCardForbidden(card)) return true;
    return shouldLockGeneralCards && !card.isPracticeCard;
  };

  const forbiddenHint = (card: Card) => {
    if (!isCardForbidden(card)) return null;
    const required = requiredDanceTypeFor(card, lesson.danceType);
    return required
      ? `未具備 ${danceTypeLabel(required)} 複習資格`
      : "複習卡未設定舞種";
  };

  const handleSelectCard = (cardId: number) => {
    const card = cardOptions.find((c) => c.id === cardId);
    if (!card) return;

    if (isCardDisabled(card)) {
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
    setCardSessions(e.target.value);
  };

  const handleCardPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardPrice(e.target.value);
  };

  const handleClose = () => {
    setOpen(false);
    setAllowManualOverride(false);
    setIsPaid(true);
  };

  const handleSubmit = async () => {
    if (selectedCardId) {
      const studentCard = await createStudentCard({
        id: record.studentId,
        cardId: selectedCardId,
        sessions: parseInt(cardSessions),
        price: parseInt(cardPrice),
        lessonId: lesson.id,
        isPaid,
      });
      if (studentCard?.data) {
        await consumeStudentCard({
          id: lesson.id,
          periodId: Number(periodId),
          studentId: studentId,
          studentCardId: studentCard.data.id,
        });
      }
      toast.success("成功買卡並使用");
      handleClose();
    }
  };

  useEffect(() => {
    if (selectedCardId) {
      const card = cardOptions.find((card) => card.id === selectedCardId);
      if (card) {
        if (isCardDisabled(card)) {
          setSelectedCardId(null);
          setCardSessions("");
          setCardPrice("");
          return;
        }
        setCardSessions(card.sessions.toString());
        setCardPrice(card.price.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardId, cardOptions, lesson, student, shouldLockGeneralCards]);

  return (
    <>
      <button
        className="text-xs font-medium rounded-full text-white bg-primary-500 hover:bg-primary-600 w-24 px-3 py-2 cursor-pointer transition-colors"
        onClick={() => setOpen(true)}
      >
        買卡並使用
      </button>
      <Drawer
        title={`為 ${record.studentName} 買卡並使用`}
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        submitText="買卡並使用"
        isLoading={isLoading || isConsumeLoading}
        disabled={!selectedCardId || !cardSessions || !cardPrice}
      >
        <div className="mb-4">
          <p>Choose card</p>
          {shouldLockGeneralCards && (
            <div className="flex flex-col gap-2 p-3 mt-2 rounded-sm bg-primary-50 border border-primary-200">
              <p className="text-xs text-primary-700">
                學生符合複習卡資格，已優先鎖定複習卡，保護學生權益
              </p>
              <button
                type="button"
                className="text-xs text-primary-700 underline text-left cursor-pointer"
                onClick={() => setAllowManualOverride(true)}
              >
                老師手動切換覆蓋
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {cardOptions?.map((card) => {
              const disabled = isCardDisabled(card);
              const isSelected = selectedCardId === card.id && !disabled;
              const hint = forbiddenHint(card);

              return (
                <div
                  key={card.id}
                  className={`flex flex-col gap-1 px-4 py-3 border-1 border-gray-200 rounded-sm ${
                    disabled
                      ? "opacity-50 cursor-not-allowed bg-gray-50"
                      : "cursor-pointer"
                  } ${
                    isSelected
                      ? "bg-primary-100 border-primary-500"
                      : ""
                  }`}
                  onClick={() => handleSelectCard(card.id)}
                >
                  <div className="flex gap-2 items-center">
                    <RoundCheckbox isChecked={isSelected} />
                    <p>{card.name}</p>
                  </div>
                  {hint && (
                    <p className="text-xs text-red-500">{hint}</p>
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

export default BuyAndUseForm;
