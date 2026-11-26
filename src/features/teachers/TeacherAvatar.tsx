import { danceStyleTones } from "@/lib/danceStyleColors";
import { teacherInitial } from "@/lib/teachers";
import { cn } from "@/lib/utils";

const SIZES = {
  /** 36 — list rows, pickers. */
  sm: "size-9 text-[15px]",
  /** 48 — team rows. */
  md: "size-12 text-lg",
  /** 64 — the teacher's own page. */
  lg: "size-16 text-2xl",
};

/**
 * The one teacher avatar: a circle in a pale tint of the teacher's colour with the first
 * character of the name in the same hue's dark ink — the same look at every size, and colour
 * is the only thing a teacher chooses. Tones are derived from the colour (`chip`), not the
 * static `badge` classes (those collide for periwinkle／indigo, navy／blue…); the letter's
 * contrast is asserted for every palette key in `src/lib/teachers.test.ts`.
 */
const TeacherAvatar = ({
  name,
  color,
  size = "md",
  muted = false,
  className,
}: {
  name: string;
  /** A palette key; anything unknown draws neutral gray. */
  color: string;
  size?: keyof typeof SIZES;
  /** Archived teachers fade out. */
  muted?: boolean;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    style={danceStyleTones(color).chip}
    className={cn(
      SIZES[size],
      "flex shrink-0 items-center justify-center rounded-full font-semibold leading-none",
      muted && "opacity-50",
      className
    )}
  >
    {teacherInitial(name)}
  </span>
);

export default TeacherAvatar;
