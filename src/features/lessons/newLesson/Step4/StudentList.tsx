import Image from "next/image";
import { Student } from "@/store/slices/students";
import { Answer } from "@/store/slices/lessons";
import RoundCheckbox from "@/components/RoundCheckbox";

const StudentList = ({
  students,
  answers,
  currentStudentId,
  onClick,
}: {
  students: Student[];
  answers: Answer[];
  currentStudentId: number | null;
  onClick: (studentId: number) => void;
}) => {
  const doneStudentIds = answers.map((answer) => answer.studentId);
  return (
    <>
      <div className="pb-3 py-3 flex flex-nowrap gap-3 overflow-x-auto">
        {students.map((student) => (
          <div
            key={student.id}
            className={`relative flex flex-row items-center gap-1 border-1 border-gray-200 rounded-sm px-2 py-2 ${
              currentStudentId === student.id
                ? "bg-primary-100 border-primary-500"
                : ""
            }`}
            onClick={() => onClick(student.id)}
          >
            <Image
              src={student.avatarUrl}
              alt={student.name}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full"
            />
            <p className="text-sm w-16 truncate">{student.name}</p>
            {doneStudentIds.includes(student.id) && (
              <RoundCheckbox
                isChecked
                className="absolute -right-2 -top-2"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 items-center">
        <div className="flex gap-2 items-center pl-3 flex-1 h-12 text-white bg-primary-500 rounded-sm">
          <p className="text-[28px] font-bold">{doneStudentIds.length}</p>
          <p className="text-sm">done</p>
        </div>
        <div className="flex gap-2 items-center pl-3 flex-1 h-12 text-primary-900 bg-primary-100 rounded-sm">
          <p className="text-[28px] font-bold">
            {students.length - doneStudentIds.length}
          </p>
          <p className="text-sm">pending</p>
        </div>
      </div>
    </>
  );
};

export default StudentList;
