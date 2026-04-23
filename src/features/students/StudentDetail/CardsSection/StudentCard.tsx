import {
  StudentCardWithCard,
  useExpireStudentCardMutation,
} from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { Rat, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

const StudentCard = ({
  studentCard,
  isPublic,
}: {
  studentCard: StudentCardWithCard;
  isPublic?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [expireStudentCard] = useExpireStudentCardMutation();
  const isFinished = studentCard.remainingSessions === 0 || !!studentCard.expiredAt;
  const usedSessions = studentCard.attendanceRecords.length;
  const progress = Math.min(100, Math.round((usedSessions / studentCard.totalSessions) * 100));
  const isPractice = studentCard.card.isPracticeCard;
  const remainingTone = isFinished ? "text-gray-400" : "text-emerald-600";
  const sessionRows = useMemo(
    () =>
      Array.from({ length: studentCard.totalSessions }, (_, index) => {
        const record = studentCard.attendanceRecords[index];
        return {
          slot: index + 1,
          record,
        };
      }),
    [studentCard.attendanceRecords, studentCard.totalSessions]
  );

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
      className="relative flex flex-col gap-3 p-3 rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <button
        className="w-full flex items-center gap-3 cursor-pointer"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-gray-900">
              {studentCard.card.name}
            </h4>
            {isPractice && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                複習卡
              </span>
            )}
          </div>
          <div className="mt-2 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${isFinished ? "bg-gray-400" : "bg-emerald-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            購買日 {formatDate(studentCard.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-sm font-semibold ${remainingTone}`}>
            {studentCard.totalSessions - studentCard.remainingSessions}/{studentCard.totalSessions}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center px-2 py-1 text-xs text-gray-500 font-medium bg-white rounded-sm">
            <span className="w-12">堂次</span>
            <span className="w-24">日期</span>
            <span className="flex-1">課程</span>
            <span className="w-24 text-right">老師</span>
          </div>
          <div className="flex flex-col">
            {sessionRows.map(({ slot, record }) => (
              <div
                key={slot}
                className="flex items-center px-2 py-2 text-xs border-b border-gray-100"
              >
                <span className="w-12 text-gray-500">#{slot}</span>
                <span className="w-24 text-gray-700">
                  {record ? formatDate(record.periodStartTime) : "未使用"}
                </span>
                <span className="flex-1 text-gray-700">{record?.lessonName || "未使用"}</span>
                <span className="w-24 text-right text-gray-500">
                  {record?.teacherName || "未使用"}
                </span>
              </div>
            ))}
          </div>
          {isFinished && (
            <div className="mt-2 rounded-md bg-rose-50 px-2 py-1">
              <p className="text-xs text-rose-500">此課卡已使用完畢，建議續約新課卡。</p>
            </div>
          )}
          {!isPublic && (
            <div className="flex justify-end pt-2">
              <button
                className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer"
                onClick={handleExpire}
              >
                <Rat className="w-4 h-4" />
                <span>Expire</span>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;
