import {
  StudentCardWithCard,
  useExpireStudentCardMutation,
} from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { Edit, Rat } from "lucide-react";
import { toast } from "sonner";

const StudentCard = ({
  studentCard,
  isPublic,
}: {
  studentCard: StudentCardWithCard;
  isPublic?: boolean;
}) => {
  const [expireStudentCard] = useExpireStudentCardMutation();
  const isFinished = studentCard.remainingSessions === 0 || !!studentCard.expiredAt;

  const handleExpire = async () => {
    const confirm = window.confirm(
      "Are you sure you want to expire this card?"
    );
    if (!confirm) return;

    await expireStudentCard({
      id: studentCard.studentId,
      studentCardId: studentCard.id,
    });
    toast.success("Card expired");
  };

  return (
    <div
      key={studentCard.id}
      className={`relative flex flex-col gap-2 p-3 rounded-sm border border-gray-200`}
    >
      <div className="flex justify-between">
        <h4 className="text-base font-light">{studentCard.card.name}</h4>
        <div className="flex flex-col w-32 gap-1 font-normal text-gray-700">
          <div className="flex justify-between">
            <span className="text-xs">價格：</span>
            <span className="text-xs">${studentCard.finalPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs">購買日：</span>
            <span className="text-xs">{formatDate(studentCard.createdAt)}</span>
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
              {formatDate(record.periodStartTime)}
            </span>
            <span className="text-xs">{record.lessonName}</span>
          </div>
        ))}
        {Array.from({ length: studentCard.remainingSessions }).map(
          (_, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center gap-1 bg-[#F2F2F2] rounded-sm p-2 h-14"
            >
              <span className="text-xs text-gray-500">-</span>
            </div>
          )
        )}
      </div>
      {!isPublic && (
        <div className="flex pt-2 mt-2 border-t border-gray-200 text-gray-700 text-sm">
          <div className="flex items-center gap-1 flex-1 justify-center">
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </div>
          <div
            className="flex items-center gap-1 flex-1 justify-center cursor-pointer"
            onClick={handleExpire}
          >
            <Rat className="w-4 h-4" />
            <span>Expire</span>
          </div>
        </div>
      )}
      {isFinished && (
        <div className="absolute top-8 right-4 border-5 border-red-600/70 text-red-600/70 text-lg font-bold rounded-lg px-4 py-3 flex items-center justify-center rotate-32">
          FINISHED
        </div>
      )}
    </div>
  );
};

export default StudentCard;
