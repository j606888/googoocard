import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { studentDetailHref } from "@/lib/studentNav";

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
  const pathname = usePathname();
  return (
    <div
      className={`flex items-center gap-2 cursor-pointer ${className}`}
      onClick={() => studentId && router.push(studentDetailHref(studentId, pathname))}
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
