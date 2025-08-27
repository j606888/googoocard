import StudentInfo from "@/components/StudentInfo";
import { AttendanceRecord } from "@/store/slices/lessons";
import { MdOutlineWarning } from "react-icons/md";

const UNCHECK_MAP = {
  no_card: {
    description: "無課卡",
    buttonText: "買卡並使用",
  },
  multiple_cards: {
    description: "多張課卡",
    buttonText: "選擇一張使用",
  },
  not_checked: {
    description: "課卡未消耗",
    buttonText: "現在使用",
  },
};
const PendingStudents = ({ records }: { records: AttendanceRecord[] }) => {
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
              avatarUrl={record.studentAvatarUrl}
              name={record.studentName}
              size="small"
            />
            <div className="flex flex-1 items-center gap-1 text-[#F87666]">
              <MdOutlineWarning className="w-4.5 h-4.5 " />
              <p className="text-sm font-medium">
                {UNCHECK_MAP[record.uncheckedType].description}
              </p>
            </div>
            <button className="text-xs rounded-full text-white bg-[#F87666] w-25 px-3 py-2 cursor-pointer">
              {UNCHECK_MAP[record.uncheckedType].buttonText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingStudents;
