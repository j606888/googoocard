import { Student } from "@/store/slices/students";
import Image from "next/image";

const StudentInfo = ({
  student,
  size = "normal",
  className,
}: {
  student: Student;
  size?: "normal" | "small";
  className?: string;
}) => {
  const imageSize = size === "normal" ? 36 : 20;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        className={`rounded-full`}
        width={imageSize}
        height={imageSize}
        src={student.avatarUrl}
        alt={student.name}
      />
      <span className={`text-${size === "normal" ? "lg" : "base"} font-medium`}>
        {student.name}
      </span>
    </div>
  );
};

export default StudentInfo;
