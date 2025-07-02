import Image from "next/image";

const StudentInfo = ({
  avatarUrl,
  name,
  size = "normal",
  className,
}: {
  avatarUrl: string;
  name: string;
  size?: "normal" | "small";
  className?: string;
}) => {
  const imageSize = size === "normal" ? 36 : 24;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
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
