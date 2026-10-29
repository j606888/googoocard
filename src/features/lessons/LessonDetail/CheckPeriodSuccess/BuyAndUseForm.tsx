import ExpandableAction from "@/components/ExpandableAction";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { useEffect, useMemo, useState } from "react";
import InputField from "@/components/InputField";
import RoundCheckbox from "@/components/RoundCheckbox";
import { Switch } from "@/components/ui/switch";
import { useCreateStudentCardMutation, useGetStudentQuery } from "@/store/slices/students";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { toast } from "sonner";
import { canBuyCard } from "@/domains/qualification";
import { practiceCardBlockedHint } from "@/lib/danceLevels";
import { Card } from "@/store/slices/cards";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/Field";

const BuyAndUseForm = ({
  record,
  lesson,
  studentId,
  periodId,
  inline = false,
  onDone,
}: {
  record: AttendanceRecord;
  lesson: Lesson;
  studentId: number;
  periodId: number;
  /** 已經在對話框裡：表單直接攤開（見 ExpandableAction） */
  inline?: boolean;
  /** 送出成功或取消後（inline 時由外層關掉對話框） */
  onDone?: () => void;
}) => {
  const { data: student } = useGetStudentQuery({ id: studentId });
  const [open, setOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [allowManualOverride, setAllowManualOverride] = useState(false);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [isPaid, setIsPaid] = useState(true);

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
    () => student?.danceLevels ?? {},
    [student]
  );

  // Practice card the student is not qualified for — hard block.
  const isCardForbidden = (card: Card) =>
    !canBuyCard(card, qualifications, lesson).allowed;

  // The lesson offers a practice card this student can buy — lock general
  // cards by default so the student's benefit isn't wasted on a pricier card.
  const shouldLockGeneralCards = useMemo(
    () =>
      cardOptions.some(
        (card) =>
          card.isPracticeCard &&
          canBuyCard(card, qualifications, lesson).allowed
      ) && !allowManualOverride,
    [cardOptions, qualifications, lesson, allowManualOverride]
  );

  // 外師課一次扣好幾格：新卡至少要夠扣這一次。
  const sessionsNeeded = record.sessionsUsed ?? 1;
  const sessionsTooFew = !!cardSessions && parseInt(cardSessions) < sessionsNeeded;

  const isCardDisabled = (card: Card) => {
    if (isCardForbidden(card)) return true;
    if (card.sessions < sessionsNeeded) return true;
    return shouldLockGeneralCards && !card.isPracticeCard;
  };

  const forbiddenHint = (card: Card) => {
    if (!isCardForbidden(card)) return null;
    return practiceCardBlockedHint(card, lesson);
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
    onDone?.();
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
          periodId,
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
      <ExpandableAction
        triggerLabel="買卡並使用"
        title={`為 ${record.studentName} 買卡並使用`}
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : handleClose())}
        inline={inline}
        onSubmit={handleSubmit}
        submitText={sessionsNeeded > 1 ? `買卡並扣 ${sessionsNeeded} 格` : "買卡並使用"}
        isLoading={isLoading || isConsumeLoading}
        disabled={!selectedCardId || !cardSessions || !cardPrice || sessionsTooFew}
      >
        <div className="mb-4">
          <FieldLabel>選擇課卡</FieldLabel>
          {shouldLockGeneralCards && (
            <div className="flex flex-col items-start gap-2 p-3 mt-2 rounded-xl bg-primary-50 border border-primary-300">
              <p className="text-xs text-primary-900">
                學生符合複習卡資格，已優先鎖定複習卡，保護學生權益
              </p>
              <Button
                type="button"
                variant="link"
                className="text-xs underline"
                onClick={() => setAllowManualOverride(true)}
              >
                老師手動切換覆蓋
              </Button>
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
                  className={`flex flex-col gap-1 px-4 py-3 border border-neutral-200 rounded-xl ${
                    disabled
                      ? "opacity-50 cursor-not-allowed bg-neutral-50"
                      : "cursor-pointer"
                  } ${
                    isSelected
                      ? "bg-primary-100 border-primary-700"
                      : ""
                  }`}
                  onClick={() => handleSelectCard(card.id)}
                >
                  <div className="flex gap-2 items-center">
                    <RoundCheckbox isChecked={isSelected} />
                    <p>{card.name}</p>
                  </div>
                  {hint && (
                    <p className="text-xs text-danger-700">{hint}</p>
                  )}
                </div>
              );
            })}
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
                  onChange={handleCardPriceChange}
                  type="number"
                />
              </div>
              <div className="mb-4">
                <InputField
                  label="課卡堂數"
                  value={cardSessions}
                  onChange={handleCardSessionsChange}
                  type="number"
                  error={
                    errors.cardSessions ||
                    (sessionsTooFew ? `這堂要扣 ${sessionsNeeded} 格` : undefined)
                  }
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
      </ExpandableAction>
    </>
  );
};

export default BuyAndUseForm;
