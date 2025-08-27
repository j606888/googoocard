import StudentInfo from "@/components/StudentInfo";
import { AttendanceRecord } from "@/store/slices/lessons";
import { MdOutlineWarning } from "react-icons/md";

const PendingStudents = ({ records }: { records: AttendanceRecord[] }) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#FFF1E6] w-full">
      <div className="flex items-center gap-1">
        <MdOutlineWarning className="w-4.5 h-4.5 text-[#F4A15E]" />
        <p className="text-sm font-medium text-warning-900">Pending Students</p>
      </div>
      <div className="flex flex-col gap-2">
        {records.map((record) => (
          <div
            key={record.studentId}
            className="flex items-center gap-2 bg-white rounded-sm px-3 py-2 "
          >
            <StudentInfo
              avatarUrl={record.studentAvatarUrl}
              name={record.studentName}
              size="small"
              className="mr-auto"
            />
            {/* {record.cardStatus === CardStatus.MISSING_CARD && <BuyAndUseForm record={record} lesson={lesson} />} */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingStudents;
