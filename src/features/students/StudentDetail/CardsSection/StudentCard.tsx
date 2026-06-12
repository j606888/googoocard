import {
  StudentCardWithCard,
  useExpireStudentCardMutation,
} from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { Rat, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMemo, useState } from "react";

const StudentCard = ({
  studentCard,
  isPublic,
}: {
  studentCard: StudentCardWithCard;
  isPublic?: boolean;
}) => {
  const [expireStudentCard] = useExpireStudentCardMutation();
  const [expanded, setExpanded] = useState(false);
  const isFinished = studentCard.remainingSessions === 0 || !!studentCard.expiredAt;
  const usedSessions = studentCard.attendanceRecords.length;
  const progress = Math.min(100, Math.round((usedSessions / studentCard.totalSessions) * 100));
  const isPractice = studentCard.card.isPracticeCard;
  const remainingTone = isFinished ? "text-gray-400" : "text-primary-600";
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
      className="relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      {/* Compact summary — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-gray-900 truncate">
              {studentCard.card.name}
            </h4>
            {isPractice && (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-warning-100 text-warning-900">
                複習卡
              </span>
            )}
          </div>
          <div className="mt-2 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${isFinished ? "bg-gray-300" : "bg-primary-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            購買日 {formatDate(studentCard.createdAt)}
          </p>
        </div>

        {/* Remaining sessions, emphasized */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right leading-none">
            <div className="flex items-baseline gap-0.5 justify-end">
              <span className={`text-2xl font-bold ${remainingTone}`}>
                {studentCard.remainingSessions}
              </span>
              <span className="text-sm text-gray-400">/{studentCard.totalSessions}</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">剩餘堂數</div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center px-2 py-1 text-xs font-medium">
                  <span className="w-12 text-gray-400">堂次</span>
                  <span className="w-24 text-gray-500">日期</span>
                  <span className="flex-1 text-gray-400">課程</span>
                  <span className="w-20 text-right text-gray-300">老師</span>
                </div>
                <div className="flex flex-col">
                  {sessionRows.map(({ slot, record }) => (
                    <div
                      key={slot}
                      className="flex items-center px-2 py-2 text-xs border-b border-gray-100"
                    >
                      <span className="w-12 text-gray-400">#{slot}</span>
                      <span className="w-24 font-medium text-gray-900">
                        {record ? formatDate(record.periodStartTime) : "未使用"}
                      </span>
                      <span className="flex-1 text-gray-700">{record?.lessonName || "未使用"}</span>
                      <span className="w-20 text-right text-xs text-gray-400">
                        {record?.teacherName || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {!isPublic && !isFinished && (
                <button
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 cursor-pointer transition-colors"
                  onClick={handleExpire}
                >
                  <Rat className="w-3.5 h-3.5" />
                  <span>Expire card</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentCard;
