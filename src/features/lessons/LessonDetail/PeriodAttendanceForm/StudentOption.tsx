import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import Image from "next/image";
import { MdInfo } from "react-icons/md";
import { formatMoney } from "@/lib/money";
import StatusTag from "@/components/StatusTag";

const StudentOption = ({
  student,
  isChecked,
  onClick,
  isAttended,
  isFirstTime = false,
  isSelfCheckIn = false,
  isTrial = false,
}: {
  student: Student;
  isAttended: boolean;
  isChecked: boolean;
  isFirstTime?: boolean;
  isSelfCheckIn?: boolean;
  isTrial?: boolean;
  onClick: (student: Student) => void;
}) => {
  const isGray = !isAttended && !isChecked;

  return (
    <div
      className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
        isChecked
          ? "bg-primary-50 border-primary-300"
          : "bg-white border-transparent hover:bg-neutral-50"
      }`}
      onClick={() => onClick(student)}
    >
      <div className="flex items-center gap-3">
        <Image
          className={`rounded-full object-cover ${isGray ? "opacity-50 grayscale" : ""}`}
          width={36}
          height={36}
          src={student.avatarUrl}
          alt={student.name}
        />
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-base font-medium ${isGray ? "text-neutral-400" : "text-neutral-900"}`}
          >
            {student.name}
          </span>
          {isSelfCheckIn && (
            <StatusTag tone="outline">自助簽到</StatusTag>
          )}
          {isTrial && (
            <StatusTag tone="outline">體驗報名</StatusTag>
          )}
          {student.isNewStudent && (
            <StatusTag tone="positive">新學員</StatusTag>
          )}
          {student.note && (
            <p className={`text-sm truncate ${isGray ? "text-neutral-400" : "text-neutral-500"}`}>
              ({student.note})
            </p>
          )}
        </div>
        {(student.unpaidAmount ?? 0) > 0 && (
          // 當堂就知道要收誰的錢（未付款永遠不擋點名）
          <StatusTag tone="danger" className="ml-auto">
            未付 ${formatMoney(student.unpaidAmount!)}
          </StatusTag>
        )}
        <RoundCheckbox
          isChecked={isChecked}
          className={`${(student.unpaidAmount ?? 0) > 0 ? "" : "ml-auto"} shrink-0`}
        />
      </div>
      {isFirstTime && (
        <div className="flex items-center gap-1 pl-12">
          <MdInfo className="w-4 h-4 text-primary-700" />
          <span className="text-xs font-medium text-primary-700">
            第一次上這門課
          </span>
        </div>
      )}
    </div>
  );
};

export default StudentOption;
