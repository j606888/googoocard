import { isToday } from "date-fns";
import { Forward, Repeat2 } from "lucide-react";
import type { StudentCardWithCard } from "@/store/slices/students";
import { formatMoney } from "@/lib/money";
import { formatCardSerial } from "@/lib/cardSerial";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { cn } from "@/lib/utils";
import StatusTag from "@/components/StatusTag";
import SessionDots from "./SessionDots";
import { isLowRemaining, lastUsedAt, shortDate } from "./cardStatus";

/** 卡名下面那一行：這張卡從哪來（轉讓／轉換／買的），複習卡帶舞種。 */
export const CardOrigin = ({ studentCard }: { studentCard: StudentCardWithCard }) => {
  const date = shortDate(studentCard.createdAt);
  const from = studentCard.transferredFrom;
  if (studentCard.origin === "TRANSFER" && from) {
    return (
      <span className="flex items-center gap-1 text-[13px] font-medium text-primary-900 min-w-0">
        <Forward className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {from.student ? from.student.name : formatCardSerial(from.serialNumber)} 轉入 · {date}
        </span>
      </span>
    );
  }
  const convertedFrom = studentCard.convertedFrom ?? [];
  if (convertedFrom.length > 0) {
    return (
      <span className="flex items-center gap-1 text-[13px] text-neutral-500 min-w-0">
        <Repeat2 className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          由 {convertedFrom.map((card) => formatCardSerial(card.serialNumber)).join("、")} 轉換 · {date}
        </span>
      </span>
    );
  }
  const style = studentCard.card.isPracticeCard ? studentCard.card.danceStyle : null;
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-neutral-500 min-w-0">
      {style && <span className={cn("size-2 rounded-full shrink-0", danceStyleMeta(style).dot)} aria-hidden />}
      <span className="truncate">
        {style ? `${style.name} · ` : ""}
        {date} 購買
      </span>
    </span>
  );
};

/**
 * 有效課卡的票根：卡名與編號、來源、大字剩餘堂數＋每堂一顆圓點，虛線下面只放
 * 需要注意的事（未付、快用完）與上次上課。整張是一顆按鈕，點了開 CardDetailDialog。
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
  const low = isLowRemaining(studentCard);
  const unpaid = studentCard.isPaid === false;
  const lastUse = lastUsedAt(studentCard);
  const serial = formatCardSerial(studentCard.serialNumber);

  return (
    <button
      type="button"
      id={`student-card-${studentCard.id}`}
      onClick={() => onOpen(studentCard)}
      aria-label={`${studentCard.card.name} ${serial}，剩 ${studentCard.remainingSessions} 堂${unpaid ? "，未付款" : ""}，查看詳情`}
      className={cn(
        "flex flex-col w-full rounded-2xl border bg-white text-left scroll-mt-4 cursor-pointer transition-[box-shadow,border-color] duration-300 hover:border-primary-300",
        highlighted ? "border-primary-700 ring-4 ring-primary-100" : "border-neutral-200"
      )}
    >
      <div className="flex flex-col gap-4 px-5 pt-[18px] pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[15px] font-bold text-neutral-900 truncate">{studentCard.card.name}</span>
            <CardOrigin studentCard={studentCard} />
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-neutral-500 tabular-nums">{serial}</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5 leading-none tabular-nums">
            <span className={cn("text-[40px] font-extrabold tracking-tight", low ? "text-danger-700" : "text-neutral-900")}>
              {studentCard.remainingSessions}
            </span>
            <span className="text-sm font-medium text-neutral-600">/ {studentCard.totalSessions} 堂</span>
          </div>
          <SessionDots
            total={studentCard.totalSessions}
            remaining={studentCard.remainingSessions}
            low={low}
            // 8 堂以上改小圓點，12 堂也排得進一行
            size={studentCard.totalSessions > 8 ? "sm" : "md"}
            className="pb-1.5 justify-end flex-nowrap"
          />
        </div>
      </div>
      <div aria-hidden className="mx-3.5 border-t-[1.5px] border-dashed border-neutral-200" />
      <div className="flex items-center justify-between gap-2 min-h-[26px] px-5 pt-3 pb-3.5">
        <span className="flex items-center gap-1.5">
          {unpaid && <StatusTag tone="warning">未付 ${formatMoney(studentCard.finalPrice)}</StatusTag>}
          {low && <StatusTag tone="danger">快用完</StatusTag>}
        </span>
        <span className="text-[13px] text-neutral-500 tabular-nums">
          {lastUse === null ? "還沒用過" : `上次 ${isToday(lastUse) ? "今天" : shortDate(lastUse)}`}
        </span>
      </div>
    </button>
  );
};

export default StudentCard;
