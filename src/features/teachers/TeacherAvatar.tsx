import { danceStyleClasses } from "@/lib/danceStyleColors";
import { teacherInitial } from "@/lib/teachers";

const SIZES = {
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-2xl",
};

/** The teacher's initial on their palette colour. */
const TeacherAvatar = ({
  name,
  color,
  size = "md",
  muted = false,
}: {
  name: string;
  color: string;
  size?: keyof typeof SIZES;
  /** Archived teachers fade out. */
  muted?: boolean;
}) => (
  <span
    aria-hidden="true"
    className={`${SIZES[size]} ${danceStyleClasses(color).bg} ${
      muted ? "opacity-50" : ""
    } rounded-full shrink-0 flex items-center justify-center font-semibold text-white`}
  >
    {teacherInitial(name)}
  </span>
);

export default TeacherAvatar;
