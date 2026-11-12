import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { useGetStudentCardsByLessonQuery } from "@/store/slices/students";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ChooseCardForm from "./ChooseCardForm";
import BuyAndUseForm from "./BuyAndUseForm";

/**
 * 「課卡未消耗」的一鍵扣卡。只有剛好一張可用的卡時才一鍵扣；
 * 卡況在點名之後變了（多了一張、或卡被用掉），就改成選卡／買卡，
 * 不讓按鈕按了沒反應。
 */
const UseNowButton = ({
  record,
  lesson,
  studentId,
  periodId,
  inline,
  onDone,
}: {
  record: AttendanceRecord;
  lesson: Lesson;
  studentId: number;
  periodId: number;
  inline?: boolean;
  onDone?: () => void;
}) => {
  const { data: studentCards, isLoading: isCardsLoading } = useGetStudentCardsByLessonQuery({
    studentId,
    lessonId: lesson.id,
  });

  const [consumeStudentCard, { isLoading }] = useConsumeStudentCardMutation();

  const formProps = { record, lesson, studentId, periodId, inline, onDone };
  if (studentCards && studentCards.length > 1) return <ChooseCardForm {...formProps} />;
  if (studentCards && studentCards.length === 0) return <BuyAndUseForm {...formProps} />;

  const handleClick = async () => {
    if (studentCards?.length !== 1) return;
    try {
      await consumeStudentCard({
        id: lesson.id,
        periodId,
        studentId: studentId,
        studentCardId: studentCards[0].id,
      }).unwrap();
    } catch {
      toast.error("扣卡失敗，請再試一次");
      return;
    }
    toast.success("成功使用課卡");
    onDone?.();
  };

  return (
    <Button
      size="sm"
      className="min-w-24"
      onClick={handleClick}
      isLoading={isLoading}
      disabled={isCardsLoading}
    >
      現在使用
    </Button>
  );
};

export default UseNowButton;
