import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import Image from "next/image";
import { MdInfo } from "react-icons/md";
import { formatMoney } from "@/lib/money";

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
            <span className="shrink-0 rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700">
              自助簽到
            </span>
          )}
          {isTrial && (
            <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-900">
              體驗報名
            </span>
          )}
          {student.isNewStudent && (
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              新學員
            </span>
          )}
          {student.note && (
            <p className={`text-sm truncate ${isGray ? "text-neutral-300" : "text-neutral-500"}`}>
              ({student.note})
            </p>
          )}
        </div>
        {(student.unpaidAmount ?? 0) > 0 && (
          // 當堂就知道要收誰的錢（未付款永遠不擋點名）
          <span className="ml-auto shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-bold text-warning-800">
            未付 ${formatMoney(student.unpaidAmount!)}
          </span>
        )}
        <RoundCheckbox
          isChecked={isChecked}
          className={`${(student.unpaidAmount ?? 0) > 0 ? "" : "ml-auto"} shrink-0`}
        />
      </div>
      {isFirstTime && (
        <div className="flex items-center gap-1 pl-12">
          <MdInfo className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-medium text-primary-700">
            第一次上這門課
          </span>
        </div>
      )}
    </div>
  );
};

export default StudentOption;
