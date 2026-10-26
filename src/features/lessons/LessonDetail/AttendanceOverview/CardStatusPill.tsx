import type { CardStatus } from "@/domains/attendance/rosterInsights";
import StatusTag from "@/components/StatusTag";

// Lesson-scoped: "can tonight's session be charged to a card?". Deliberately
// never worded 需續約 — that is the classroom-wide tag from studentTag.ts and
// two different rules wearing one word on the same screen is how they get
// conflated.
//
// Fixed width so every roster row's streak strip is the same width and lines up
// under the date header (RosterList).
const CardStatusPill = ({ status }: { status: CardStatus }) => {
  const { level, usableSessions, blockedCardCount } = status;

  const label =
    level === "none"
      ? blockedCardCount > 0
        ? "資格不符"
        : "無可用卡"
      : `剩 ${usableSessions} 堂`;

  const tone = level === "none" ? "danger" : level === "low" ? "warning" : "positive";

  return (
    <span
      title={
        level === "none" && blockedCardCount > 0
          ? "有這堂課的複習卡，但學生還沒有該舞種的資格"
          : undefined
      }
      className="shrink-0 w-[72px] flex"
    >
      <StatusTag tone={tone} className="w-full justify-center px-2 text-[10.5px]">
        {label}
      </StatusTag>
    </span>
  );
};

export default CardStatusPill;
