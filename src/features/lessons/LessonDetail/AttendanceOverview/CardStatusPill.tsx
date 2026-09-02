import type { CardStatus } from "@/domains/attendance/rosterInsights";

// Lesson-scoped: "can tonight's session be charged to a card?". Deliberately
// never worded 需續約 — that is the classroom-wide tag from studentTag.ts and
// two different rules wearing one word on the same screen is how they get
// conflated.
const CardStatusPill = ({ status }: { status: CardStatus }) => {
  const { level, usableSessions, blockedCardCount } = status;

  const label =
    level === "none"
      ? blockedCardCount > 0
        ? "資格不符"
        : "無可用卡"
      : `剩 ${usableSessions} 堂`;

  const style =
    level === "none"
      ? "bg-danger-50 text-danger-600 border-danger-200"
      : level === "low"
      ? "bg-warning-100 text-warning-900 border-warning-200"
      : "bg-primary-50 text-primary-700 border-primary-300";

  return (
    <span
      title={
        level === "none" && blockedCardCount > 0
          ? "有這堂課的複習卡，但學生還沒有該舞種的資格"
          : undefined
      }
      className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${style}`}
    >
      {label}
    </span>
  );
};

export default CardStatusPill;
