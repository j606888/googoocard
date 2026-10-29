import ExpandableAction from "@/components/ExpandableAction";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { useEffect, useMemo, useState } from "react";
import { useGetStudentCardsByLessonQuery } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import CardSerial from "@/components/CardSerial";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";

const ChooseCardForm = ({
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
  const [open, setOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [allowManualOverride, setAllowManualOverride] = useState(false);
  const [consumeStudentCard, { isLoading }] = useConsumeStudentCardMutation();
  const { data: studentCards } = useGetStudentCardsByLessonQuery({
    studentId,
    lessonId: lesson.id,
  });

  const isPracticePriority = record.reason === "PRACTICE_PRIORITY";
  const recommendedPracticeCard = useMemo(
    () =>
      studentCards?.find(
        (card) =>
          card.id === record.recommendedStudentCardId && card.card.isPracticeCard
      ),
    [record.recommendedStudentCardId, studentCards]
  );
  const shouldLockGeneralCards = isPracticePriority && !!recommendedPracticeCard && !allowManualOverride;
  // 外師課一次扣好幾格：剩不夠的卡不能用（不拆到兩張卡），請學生買新卡。
  const sessionsNeeded = record.sessionsUsed ?? 1;
  const isShort = (remainingSessions: number) => remainingSessions < sessionsNeeded;

  useEffect(() => {
    if (recommendedPracticeCard?.id) {
      setSelectedCardId(recommendedPracticeCard.id);
    }
  }, [recommendedPracticeCard?.id]);

  const handleSelectCard = (cardId: number) => {
    const clickedCard = studentCards?.find((studentCard) => studentCard.id === cardId);
    if (
      shouldLockGeneralCards &&
      clickedCard &&
      !clickedCard.card.isPracticeCard
    ) {
      return;
    }
    if (clickedCard && isShort(clickedCard.remainingSessions)) {
      return;
    }
    setSelectedCardId(cardId);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedCardId(null);
    setAllowManualOverride(false);
    onDone?.();
  };

  const handleSubmit = async () => {
    if (!selectedCardId) return;

    await consumeStudentCard({
      id: lesson.id,
      periodId,
      studentId,
      studentCardId: selectedCardId,
    });
    toast.success("成功使用課卡");
    handleClose();
  };

  return (
    <>
      <ExpandableAction
        triggerLabel="選擇一張使用"
        title={`為 ${record.studentName} 選擇課卡使用`}
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : handleClose())}
        inline={inline}
        onSubmit={handleSubmit}
        submitText={sessionsNeeded > 1 ? `扣 ${sessionsNeeded} 格` : "使用這張"}
        disabled={!selectedCardId}
        isLoading={isLoading}
      >
        <div className="flex flex-col gap-4 mb-4">
          {shouldLockGeneralCards && (
            <div className="flex flex-col items-start gap-2 p-3 rounded-xl bg-primary-50 border border-primary-300">
              <p className="text-xs text-primary-900">
                已自動選擇複習課卡，保護學生一般課卡點數
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
          {studentCards?.map((studentCard) => (
            <div
              key={studentCard.id}
              className={`relative flex flex-col gap-2 p-3 rounded-xl border border-neutral-200 ${
                (shouldLockGeneralCards && !studentCard.card.isPracticeCard) ||
                isShort(studentCard.remainingSessions)
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              } ${
                selectedCardId === studentCard.id
                  ? "border-primary-700 bg-primary-50"
                  : ""
              }`}
              onClick={() => handleSelectCard(studentCard.id)}
            >
              <div className="flex justify-between">
                <div className="flex items-start gap-2 min-w-0">
                  <CardSerial serialNumber={studentCard.serialNumber} className="mt-0.5" />
                  <h4 className="text-base font-light">
                    {studentCard.card.name}
                  </h4>
                  {isShort(studentCard.remainingSessions) && (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      不夠扣
                    </span>
                  )}
                </div>
                <div className="flex flex-col w-32 gap-1 font-normal text-neutral-700">
                  <div className="flex justify-between">
                    <span className="text-xs">價格：</span>
                    <span className="text-xs">${formatMoney(studentCard.finalPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs">購買日：</span>
                    <span className="text-xs">
                      {formatDate(studentCard.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {studentCard.attendanceRecords.map((record, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-center gap-1 bg-neutral-100 rounded-lg p-2 h-14"
                  >
                    <span className="text-xs text-neutral-700">
                      {formatDate(
                        (record as any).lessonPeriod.attendanceTakenAt
                      )}
                    </span>
                    <span className="text-xs">
                      {(record as any).lessonPeriod.lesson.name}
                    </span>
                  </div>
                ))}
                {Array.from({ length: studentCard.remainingSessions }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg p-2 h-14 ${
                        selectedCardId === studentCard.id
                          ? "bg-primary-100"
                          : "bg-neutral-100"
                      }`}
                    >
                      <span className="text-xs text-neutral-500">-</span>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </ExpandableAction>
    </>
  );
};

export default ChooseCardForm;
