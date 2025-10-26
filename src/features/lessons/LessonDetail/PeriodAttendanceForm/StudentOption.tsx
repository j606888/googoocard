import { Student } from "@/store/slices/students";
import RoundCheckbox from "@/components/RoundCheckbox";
import Image from "next/image";
import { MdInfo } from "react-icons/md";

const StudentOption = ({
  student,
  isChecked,
  onClick,
  isAttended,
  isFirstTime = false,
}: {
  student: Student;
  isAttended: boolean;
  isChecked: boolean;
  isFirstTime?: boolean;
  onClick: (student: Student) => void;
}) => {
  const isGray = !isAttended && !isChecked;

  return (
    <div
      className={`flex flex-col gap-2 px-3 py-2 ${
        isFirstTime ? "bg-primary-50 border-l-4 border-primary-700" : ""
      }`}
    >
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onClick(student)}>
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
    </div>
  );
};

export default StudentOption;
