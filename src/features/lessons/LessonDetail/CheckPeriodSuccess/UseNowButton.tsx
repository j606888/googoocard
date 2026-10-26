import { Lesson } from "@/store/slices/lessons";
import { useGetStudentCardsByLessonQuery } from "@/store/slices/students";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const UseNowButton = ({
  lesson,
  studentId,
}: {
  lesson: Lesson;
  studentId: number;
}) => {
  const { data: studentCards } = useGetStudentCardsByLessonQuery({
    studentId,
    lessonId: lesson.id,
  });
  const { periodId } = useParams();

  const [consumeStudentCard, { isLoading }] = useConsumeStudentCardMutation();

  const handleClick = async () => {
    if (studentCards?.length === 1) {
      await consumeStudentCard({
        id: lesson.id,
        periodId: Number(periodId),
        studentId: studentId,
        studentCardId: studentCards[0].id,
      });
      toast.success("成功使用課卡");
    }
  };

  return (
    <Button size="sm" className="min-w-24" onClick={handleClick} isLoading={isLoading}>
      現在使用
    </Button>
  );
};

export default UseNowButton;
