import { Lesson } from "@/store/slices/lessons";
import { useGetStudentCardsByLessonQuery } from "@/store/slices/students";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { useParams } from "next/navigation";
import { toast } from "sonner";

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
    <button
      className="text-xs rounded-full text-white bg-[#F87666] w-25 px-3 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleClick}
      disabled={isLoading}
    >
      現在使用
    </button>
  );
};

export default UseNowButton;
