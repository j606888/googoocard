import { LessonStudent } from "@/store/slices/lessons";
import Image from "next/image";

const StudentSection = ({ students }: { students: LessonStudent[] }) => {
  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="flex flex-col ">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex items-center justify-between gap-2 py-3 border-b border-gray-200"
          >
            <div className="flex items-center gap-2">
              <Image
                src={student.avatarUrl}
                alt={student.name}
                width={40}
                height={40}
                className="rounded-full"
              />
              <p className="text-lg font-semibold">{student.name}</p>
            </div>
            <div className="flex items-center gap-1">
              {student.attendances.map((attendance, index) => (
                <Round key={index} status={attendance} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-md text-sm font-bold">
        Invite Student
      </button>
    </div>
  );
};

const Round = ({
  status = "not_started",
}: {
  status?: "not_started" | "attended" | "absent";
}) => {
  return (
    <div
      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
        status === "not_started"
          ? "bg-gray-100 border-gray-200"
          : status === "attended"
          ? "bg-primary-500 border-primary-500"
          : "bg-white border-gray-200"
      }`}
    ></div>
  );
};

export default StudentSection;
