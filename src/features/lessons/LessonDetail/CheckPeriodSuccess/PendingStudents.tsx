import StudentInfo from "@/components/StudentInfo";
import BuyAndUseForm from "./BuyAndUseForm";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { MdOutlineWarning } from "react-icons/md";
import ChooseCardForm from "./ChooseCardForm";
import UseNowButton from "./UseNowButton";

const UNCHECK_DESCRIPTION_MAP = {
  no_card: "無課卡",
  no_practice_card: "無複習課卡",
  multiple_cards: "多張課卡",
  not_checked: "課卡未消耗",
  not_qualified: "未具備複習卡資格",
};
const PendingStudents = ({
  records,
  lesson,
}: {
  records: AttendanceRecord[];
  lesson: Lesson;
}) => {
  return (
    <div className="flex flex-col gap-2 w-full rounded-2xl border border-danger-200 bg-danger-50/60 p-3">
      <div className="flex items-center gap-1.5 text-danger-600">
        <MdOutlineWarning className="w-4 h-4" />
        <p className="text-sm font-semibold">未綁定課卡學生</p>
      </div>
      <div className="flex flex-col gap-1">
        {records.map((record) => (
          <div
            key={record.studentId}
            className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-2 border border-danger-100"
          >
            <StudentInfo
              studentId={record.studentId}
              avatarUrl={record.studentAvatarUrl}
              name={record.studentName}
              size="small"
            />
            <div className="flex flex-1 items-center gap-1 text-danger-500">
              <p className="text-xs font-medium">
                {UNCHECK_DESCRIPTION_MAP[record.uncheckedType]}
              </p>
            </div>
            {["no_card", "no_practice_card", "not_qualified"].includes(record.uncheckedType) ? (
              <BuyAndUseForm
                record={record}
                lesson={lesson}
                studentId={record.studentId}
              />
            ) : record.uncheckedType === "multiple_cards" ? (
              <ChooseCardForm
                record={record}
                lesson={lesson}
                studentId={record.studentId}
              />
            ) : (
              <UseNowButton
                lesson={lesson}
                studentId={record.studentId}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingStudents;
