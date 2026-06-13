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
  isSelfCheckIn = false,
}: {
  student: Student;
  isAttended: boolean;
  isChecked: boolean;
  isFirstTime?: boolean;
  isSelfCheckIn?: boolean;
  onClick: (student: Student) => void;
}) => {
  const isGray = !isAttended && !isChecked;

  return (
    <div
      className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
        isChecked
          ? "bg-primary-50 border-primary-300"
          : "bg-white border-transparent hover:bg-gray-50"
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
            className={`text-base font-medium ${isGray ? "text-gray-400" : "text-gray-900"}`}
          >
            {student.name}
          </span>
          {isSelfCheckIn && (
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              自助簽到
            </span>
          )}
          {student.note && (
            <p className={`text-sm truncate ${isGray ? "text-gray-300" : "text-gray-500"}`}>
              ({student.note})
            </p>
          )}
        </div>
        <RoundCheckbox isChecked={isChecked} className="ml-auto shrink-0" />
      </div>
      {isFirstTime && (
        <div className="flex items-center gap-1 pl-12">
          <MdInfo className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-medium text-primary-700">
            First time joined class
          </span>
        </div>
      )}
    </div>
  );
};

export default StudentOption;
