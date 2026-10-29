import type { CardStatus } from "@/domains/attendance/rosterInsights";
import StatusTag from "@/components/StatusTag";
import { cn } from "@/lib/utils";

// Lesson-scoped: "can tonight's session be charged to a card?". Deliberately
// never worded 需續約 — that is the classroom-wide tag from studentTag.ts and
// two different rules wearing one word on the same screen is how they get
// conflated.
//
// Fixed width so every roster row's streak strip is the same width and lines up
// under the date header (RosterList). `compact` (the phone roster) uses the
// short label and right-aligns instead of stretching.
const CardStatusPill = ({
  status,
  variant = "expanded",
}: {
  status: CardStatus;
  variant?: "compact" | "expanded";
}) => {
  const { level, usableSessions, blockedCardCount } = status;
  const compact = variant === "compact";

  const label =
    level === "none"
      ? blockedCardCount > 0
        ? "資格不符"
        : compact
          ? "沒卡"
          : "無可用卡"
      : `剩 ${usableSessions} 堂`;

  // No card is a sale to make, not an alarm — warning, like the triage list.
  const tone = level === "ok" ? "positive" : "warning";

  return (
    <span
      title={
        level === "none" && blockedCardCount > 0
          ? "有這堂課的複習卡，但學生還沒有該舞種的資格"
          : undefined
      }
      className={cn("shrink-0 flex", compact ? "w-[84px] justify-end" : "w-[72px]")}
    >
      <StatusTag
        tone={tone}
        className={compact ? "px-2" : "w-full justify-center px-2 text-[10.5px]"}
      >
        {label}
      </StatusTag>
    </span>
  );
};

export default CardStatusPill;
