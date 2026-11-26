import { isToday } from "date-fns";
import { ChevronRight } from "lucide-react";
import type { StudentCardWithCard } from "@/store/slices/students";
import { formatMoney } from "@/lib/money";
import { formatCardSerial } from "@/lib/cardSerial";
import DanceStyleDot from "@/components/DanceStyleDot";
import { cn } from "@/lib/utils";
import SessionDots from "./SessionDots";
import { isLowRemaining, lastUsedAt, shortDate } from "./cardStatus";

/** 這張卡哪一天、怎麼來的：「8/9 買」「王小明 轉入 · 8/9」「由 #A0030 轉換 · 8/9」。 */
export function cardOriginLabel(studentCard: StudentCardWithCard): string {
  const date = shortDate(studentCard.createdAt);
  const from = studentCard.transferredFrom;
  if (studentCard.origin === "TRANSFER" && from) {
    return `${from.student ? from.student.name : formatCardSerial(from.serialNumber)} 轉入 · ${date}`;
  }
  const convertedFrom = studentCard.convertedFrom ?? [];
  if (convertedFrom.length > 0) {
    return `由 ${convertedFrom.map((card) => formatCardSerial(card.serialNumber)).join("、")} 轉換 · ${date}`;
  }
  return `${date} 買`;
}

/**
 * 有效課卡的一列（不是一張框起來的票根）。固定的閱讀順序回答三件事：
 * 第一行卡名＋編號，右邊是這一列唯一的大字「剩 N 堂」；第二行什麼時候買的 ·
 * 付款了沒 · 上次什麼時候來 · 快用完；右邊數字下面一堂一顆圓點。
 * 未付款、快用完都只是列裡的琥珀色文字。整列是一顆按鈕，點了開 CardDetailDialog。
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
  const { remainingSessions: remaining, totalSessions: total } = studentCard;
  const style = studentCard.card.isPracticeCard ? studentCard.card.danceStyle : null;
  const origin = cardOriginLabel(studentCard);
  const payment = unpaid ? `未付 $${formatMoney(studentCard.finalPrice)}` : "已付款";
  const lastUseLabel = lastUse === null ? "還沒用過" : `上次 ${isToday(lastUse) ? "今天" : shortDate(lastUse)}`;
  const sessionsLabel = `剩 ${remaining} 堂，共 ${total} 堂`;

  return (
    <button
      type="button"
      id={`student-card-${studentCard.id}`}
      onClick={() => onOpen(studentCard)}
      aria-label={[
        `${studentCard.card.name} ${serial}`,
        sessionsLabel,
        low ? "快用完" : null,
        origin,
        payment,
        lastUseLabel,
        "查看詳情",
      ]
        .filter(Boolean)
        .join("，")}
      className={cn(
        "-mx-3 flex w-[calc(100%+1.5rem)] min-h-16 items-center gap-3 rounded-xl px-3 py-3.5 text-left scroll-mt-4 cursor-pointer transition-colors duration-300 hover:bg-primary-50 outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300",
        highlighted && "bg-primary-50"
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-base font-semibold text-ink">{studentCard.card.name}</span>
          <span className="shrink-0 text-[13px] tabular-nums text-ink-3">{serial}</span>
        </span>
        <span className="text-[13px] leading-snug tabular-nums text-ink-3">
          {style && (
            <>
              <DanceStyleDot style={style} className="mr-1.5 align-middle" />
              {style.name}
              {" · "}
            </>
          )}
          {origin}
          {" · "}
          <span className={cn("whitespace-nowrap", unpaid && "font-semibold text-warning-800")}>{payment}</span>
          {" · "}
          {lastUseLabel}
          {low && (
            <>
              {" · "}
              <span className="whitespace-nowrap font-semibold text-warning-800">快用完</span>
            </>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="flex items-baseline gap-1 whitespace-nowrap leading-none tabular-nums">
          <span className="text-[13px] text-ink-2">剩</span>
          <span className={cn("text-[26px] font-semibold tracking-tight", low ? "text-warning-800" : "text-ink")}>
            {remaining}
          </span>
          <span className="text-[13px] text-ink-3">/ {total} 堂</span>
        </span>
        <SessionDots total={total} remaining={remaining} low={low} align="end" />
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
    </button>
  );
};

export default StudentCard;
