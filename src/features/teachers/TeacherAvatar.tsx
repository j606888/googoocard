import { danceStyleClasses } from "@/lib/danceStyleColors";
import { teacherInitial } from "@/lib/teachers";
import { teacherIconGlyph } from "./teacherIcons";

const SIZES = {
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-2xl",
};

const ICON_SIZES = { sm: "size-[18px]", md: "size-6", lg: "size-8" };

/**
 * The teacher's avatar on their palette colour: the initial on the solid colour, or —
 * with an icon — a single-colour line icon on a pale tint of it (`badge` = light bg + dark text).
 */
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
}) => {
  const glyph = teacherIconGlyph(icon);
  const palette = danceStyleClasses(color);
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} ${glyph ? palette.badge : `${palette.bg} text-white`} ${
        muted ? "opacity-50" : ""
      } rounded-full shrink-0 flex items-center justify-center font-semibold leading-none`}
    >
      {glyph ? <glyph.Icon className={ICON_SIZES[size]} strokeWidth={1.75} /> : teacherInitial(name)}
    </span>
  );
};

export default TeacherAvatar;
