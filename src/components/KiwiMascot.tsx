import { cn } from "@/lib/utils";

/** Every pose drawn so far — one file each in `public/images/kiwi/` (sources: `design/kiwi/svg/`). */
export const KIWI_POSES = [
  "stand", "stand-34", "side", "back",
  "happy", "surprised", "sleepy", "confused", "cry", "proud",
  "dance", "jump", "wave", "card", "sleep", "sit", "lost", "trip",
] as const;
export type KiwiPose = (typeof KIWI_POSES)[number];

/**
 * The full-colour kiwi mascot — decorative, so it is hidden from screen readers. Size it with
 * a width class (`w-24`); the height follows the pose. It faces right; `flip` turns it left.
 * For a one-colour mark (logo tile, stamp, watermark) use `KiwiLogo` instead.
 */
const KiwiMascot = ({
  pose = "stand",
  flip = false,
  className,
}: {
  pose?: KiwiPose;
  flip?: boolean;
  className?: string;
}) => (
  // A static SVG from /public: next/image adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`/images/kiwi/kiwi-${pose}.svg`}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={cn("select-none", flip && "-scale-x-100", className)}
  />
);

export default KiwiMascot;
