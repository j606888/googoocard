import Image from "next/image";
import { useRouter } from "next/navigation";

const StudentInfo = ({
  studentId,
  avatarUrl,
  name,
  size = "normal",
  className,
}: {
  studentId?: number;
  avatarUrl: string;
  name: string;
  size?: "normal" | "small";
  className?: string;
}) => {
  const imageSize = size === "normal" ? 36 : 24;
  const router = useRouter();
  return (
    <div
      className={`flex items-center gap-2 cursor-pointer ${className}`}
      onClick={() => studentId && router.push(`/students/${studentId}`)}
    >
      <Image
        className={`rounded-full`}
        width={imageSize}
        height={imageSize}
        src={avatarUrl}
        alt={name}
      />
      <span className={`text-${size === "normal" ? "lg" : "base"} font-medium`}>
        {name}
      </span>
    </div>
  );
};

export default StudentInfo;
