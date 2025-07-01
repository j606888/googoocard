import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import Image from "next/image";
import { MdInfo, MdWarning, MdAddCard } from "react-icons/md";

const StudentOption = ({
  student,
  isChecked,
  onClick,
  isAttended,
  isFirstTime = false,
  noCard = false,
}: {
  student: Student;
  isAttended: boolean;
  isChecked: boolean;
  isFirstTime?: boolean;
  noCard?: boolean;
  onClick: (student: Student) => void;
}) => {
  const isGray = !isAttended && !isChecked;

  return (
    <div
      className={`flex flex-col gap-2 px-3 py-2 ${
        noCard ? "bg-warning-100 border-l-4 border-warning-500" : isFirstTime ? "bg-primary-50 border-l-4 border-primary-700" : ""
      }`}
    >
      <div className="flex items-center gap-3" onClick={() => onClick(student)}>
        <Image
          className={`rounded-full ${isGray ? "opacity-50" : ""}`}
          width={36}
          height={36}
          src={student.avatarUrl}
          alt={student.name}
        />
        <span
          className={`text-lg font-medium ${isGray ? "text-gray-300" : ""}`}
        >
          {student.name}
        </span>
        <RoundCheckbox isChecked={isChecked} className="ml-auto" />
      </div>
      {isFirstTime && (
        <div className="flex items-center gap-1">
          <MdInfo className="w-4.5 h-4.5 text-primary-700" />
          <span className="text-sm font-medium text-primary-900">
            First time joined class
          </span>
        </div>
      )}
      {noCard && (
        <div className="flex items-center gap-1">
          <MdWarning className="w-4.5 h-4.5 text-warning-500" />
          <span className="text-sm font-medium text-warning-900">
          No available card.
          </span>
          <div className="ml-auto bg-[#F4A15E] rounded-full px-3 py-1 flex items-center gap-1">
            <MdAddCard className="w-4.5 h-4.5 text-white" />
            <span className="text-sm font-medium text-white">Buy Card</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentOption;
