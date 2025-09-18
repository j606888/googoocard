import Drawer from "@/components/Drawer";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { useState } from "react";
import { useGetStudentCardsByLessonQuery } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { useConsumeStudentCardMutation } from "@/store/slices/lessons";
import { useParams } from "next/navigation";
import { toast } from "sonner";

const ChooseCardForm = ({
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
  const { periodId } = useParams();
  const [consumeStudentCard, { isLoading }] = useConsumeStudentCardMutation();
  const { data: studentCards } = useGetStudentCardsByLessonQuery({
    studentId,
    lessonId: lesson.id,
  });

  const handleSelectCard = (cardId: number) => {
    setSelectedCardId(cardId);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedCardId(null);
  };

  const handleSubmit = async () => {
    if (!selectedCardId) return;

    await consumeStudentCard({
      id: lesson.id,
      periodId: Number(periodId),
      studentId,
      studentCardId: selectedCardId,
    });
    toast.success("成功使用課卡");
    handleClose();
  };

  return (
    <>
      <button
        className="text-xs rounded-full text-white bg-[#F87666] w-25 px-3 py-2 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        選擇一張使用
      </button>
      <Drawer
        title={`為 ${record.studentName} 選擇課卡使用`}
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        submitText="使用這張"
        disabled={!selectedCardId}
        isLoading={isLoading}
      >
        <div className="flex flex-col gap-4 mb-4">
          {studentCards?.map((studentCard) => (
            <div
              key={studentCard.id}
              className={`relative flex flex-col gap-2 p-3 rounded-sm border border-gray-200 cursor-pointer ${
                selectedCardId === studentCard.id
                  ? "border-primary-500 bg-[#F1FAF6]"
                  : ""
              }`}
              onClick={() => handleSelectCard(studentCard.id)}
            >
              <div className="flex justify-between">
                <h4 className="text-base font-light">
                  {studentCard.card.name}
                </h4>
                <div className="flex flex-col w-32 gap-1 font-normal text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-xs">價格：</span>
                    <span className="text-xs">${studentCard.finalPrice}</span>
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
                    className="flex flex-col items-center justify-center gap-1 bg-[#F2F2F2] rounded-sm p-2 h-14"
                  >
                    <span className="text-xs text-gray-700">
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
                      className={`flex flex-col items-center justify-center gap-1  rounded-sm p-2 h-14 ${
                        selectedCardId === studentCard.id
                          ? "bg-[#DBECE6]"
                          : "bg-[#F2F2F2]"
                      }`}
                    >
                      <span className="text-xs text-gray-500">-</span>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </>
  );
};

export default ChooseCardForm;
