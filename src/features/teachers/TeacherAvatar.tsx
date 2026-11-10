import { danceStyleClasses } from "@/lib/danceStyleColors";
import { teacherInitial } from "@/lib/teachers";

const SIZES = {
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-2xl",
};

// Emoji read smaller than a letter at the same font size.
const ICON_SIZES = { sm: "text-lg", md: "text-2xl", lg: "text-[32px]" };

/** The teacher's emoji — or, without one, their initial — on their palette colour. */
const TeacherAvatar = ({
  name,
  color,
  icon,
  size = "md",
  muted = false,
}: {
  name: string;
  color: string;
  icon?: string | null;
  size?: keyof typeof SIZES;
  /** Archived teachers fade out. */
  muted?: boolean;
}) => (
  <span
    aria-hidden="true"
    className={`${SIZES[size]} ${icon ? ICON_SIZES[size] : ""} ${danceStyleClasses(color).bg} ${
      muted ? "opacity-50" : ""
    } rounded-full shrink-0 flex items-center justify-center font-semibold leading-none text-white`}
  >
    {icon || teacherInitial(name)}
  </span>
);

export default TeacherAvatar;
