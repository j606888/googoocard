import type { StudentCardWithCard } from "@/store/slices/students";
import { formatMoney } from "@/lib/money";
import { formatCardSerial } from "@/lib/cardSerial";
import CardStatusPills from "./CardStatusPills";
import { isCardEnded, isLowRemaining, shortDate } from "./cardStatus";

/**
 * 有效課卡的摘要卡：卡名、編號與購買日、狀態 pill、大字剩餘堂數、進度條、金額。
 * 整張是一顆按鈕，點了開 CardDetailDialog 看使用紀錄和操作——卡片本身不再展開。
 */
const StudentCard = ({
  studentCard,
  highlighted = false,
  onOpen,
}: {
  studentCard: StudentCardWithCard;
  /** 從轉換鏈另一端跳過來時短暫高亮 */
  highlighted?: boolean;
  onOpen: (studentCard: StudentCardWithCard) => void;
}) => {
  const ended = isCardEnded(studentCard);
  const low = !ended && isLowRemaining(studentCard);
  const ratio =
    studentCard.totalSessions > 0
      ? Math.min(100, Math.round((studentCard.remainingSessions / studentCard.totalSessions) * 100))
      : 0;
  const convertedFrom = studentCard.convertedFrom ?? [];

  return (
    <button
      type="button"
      id={`student-card-${studentCard.id}`}
      onClick={() => onOpen(studentCard)}
      aria-label={`${studentCard.card.name} ${formatCardSerial(studentCard.serialNumber)}，剩 ${studentCard.remainingSessions} 堂，查看詳情`}
      className={`flex flex-col gap-2.5 w-full p-4 rounded-2xl border bg-white text-left shadow-sm scroll-mt-4 cursor-pointer transition-[box-shadow,border-color] duration-300 hover:border-primary-400 hover:shadow-md ${
        highlighted ? "border-primary-500 ring-4 ring-primary-100" : "border-neutral-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-neutral-900 truncate">{studentCard.card.name}</div>
          <div className="text-xs text-neutral-500 tabular-nums mt-0.5">
            {formatCardSerial(studentCard.serialNumber)} · {shortDate(studentCard.createdAt)} 購買
          </div>
        </div>
        <CardStatusPills studentCard={studentCard} />
      </div>

      <div className={`leading-none font-bold tabular-nums ${low ? "text-danger-600" : "text-neutral-900"}`}>
        <span className="text-[28px]">{studentCard.remainingSessions}</span>
        <span className="text-sm font-medium text-neutral-600"> / {studentCard.totalSessions} 堂</span>
      </div>

      <div
        className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={studentCard.totalSessions}
        aria-valuenow={studentCard.remainingSessions}
        aria-label="剩餘堂數"
      >
        <div
          className={`h-full rounded-full ${low ? "bg-danger-500" : "bg-primary-500"}`}
          style={{ width: `${ratio}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-neutral-600">
        <span className="min-w-0 truncate">
          {convertedFrom.length > 0
            ? `來自 ${convertedFrom.map((from) => formatCardSerial(from.serialNumber)).join("、")}`
            : studentCard.note ?? ""}
        </span>
        <span className="shrink-0 tabular-nums">${formatMoney(studentCard.finalPrice)}</span>
      </div>
    </button>
  );
};

export default StudentCard;
