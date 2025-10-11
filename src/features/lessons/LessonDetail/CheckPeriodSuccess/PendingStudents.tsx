import StudentInfo from "@/components/StudentInfo";
import BuyAndUseForm from "./BuyAndUseForm";
import { AttendanceRecord, Lesson } from "@/store/slices/lessons";
import { MdOutlineWarning } from "react-icons/md";
import ChooseCardForm from "./ChooseCardForm";
import UseNowButton from "./UseNowButton";

const UNCHECK_DESCRIPTION_MAP = {
  no_card: "無課卡",
  multiple_cards: "多張課卡",
  not_checked: "課卡未消耗",
};
const PendingStudents = ({
  records,
  lesson,
}: {
  records: AttendanceRecord[];
  lesson: Lesson;
}) => {
  return (
    <div className="flex flex-col gap-2 py-3 w-full">
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium">未綁定課卡學生</p>
      </div>
      <div className="flex flex-col gap-2">
        {records.map((record) => (
          <div
            key={record.studentId}
            className="flex items-center gap-2 bg-white rounded-sm py-2 "
          >
            <StudentInfo
              studentId={record.studentId}
              avatarUrl={record.studentAvatarUrl}
              name={record.studentName}
              size="small"
            />
            <div className="flex flex-1 items-center gap-1 text-[#F87666]">
              <MdOutlineWarning className="w-4.5 h-4.5 " />
              <p className="text-sm font-medium">
                {UNCHECK_DESCRIPTION_MAP[record.uncheckedType]}
              </p>
            </div>
            {record.uncheckedType === "no_card" ? (
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
