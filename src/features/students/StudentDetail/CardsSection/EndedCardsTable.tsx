import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { StudentCardWithCard } from "@/store/slices/students";
import { formatCardSerial } from "@/lib/cardSerial";
import { cardEndReason, cardOutcome, cardPeriodLabel } from "./cardStatus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 預設只列最近這幾張，其餘收在「看全部 N 張」後面。 */
const INITIAL_ROWS = 3;

/**
 * 已結束的課卡（用完／停用／已轉換／已轉讓）：安靜的兩行清單，不是表格——
 * 第一行卡名＋編號，第二行怎麼結束的 · 期間，右邊用文字寫堂數。
 * 預設只列最近 3 張，「看全部 N 張」原地展開、可以再收合。
 * 點一列一樣開詳情對話框看使用紀錄。
 */
const EndedCardsTable = ({
  studentCards,
  highlightedId,
  onOpen,
}: {
  studentCards: StudentCardWithCard[];
  highlightedId: number | null;
  onOpen: (studentCard: StudentCardWithCard) => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const collapsible = studentCards.length > INITIAL_ROWS;
  // 從轉換鏈跳過來的那張卡如果收在後面，就先展開，才捲得到它。
  if (
    !showAll &&
    highlightedId !== null &&
    studentCards.slice(INITIAL_ROWS).some((card) => card.id === highlightedId)
  ) {
    setShowAll(true);
  }
  const rows = showAll ? studentCards : studentCards.slice(0, INITIAL_ROWS);

  return (
    <div>
      <ul className="m-0 p-0 list-none divide-y divide-line border-b border-line">
        {rows.map((card) => {
          const used = card.totalSessions - card.remainingSessions;
          const outcome = cardOutcome(card);
          const sessions = outcome === "usedUp" ? `${card.totalSessions} 堂` : `上了 ${used} / ${card.totalSessions} 堂`;
          return (
            <li key={card.id}>
              <button
                type="button"
                id={`student-card-${card.id}`}
                onClick={() => onOpen(card)}
                className={cn(
                  "-mx-3 flex w-[calc(100%+1.5rem)] min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left scroll-mt-4 cursor-pointer transition-colors duration-500 hover:bg-primary-50 outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300",
                  highlightedId === card.id && "bg-primary-50"
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">{card.card.name}</span>
                    <span className="shrink-0 text-[13px] tabular-nums text-ink-3">
                      {formatCardSerial(card.serialNumber)}
                    </span>
                  </span>
                  <span className="truncate text-[13px] tabular-nums text-ink-3">
                    {cardEndReason(card)} · {cardPeriodLabel(card)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-ink-3">{sessions}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
              </button>
            </li>
          );
        })}
      </ul>
      {collapsible && (
        <Button
          type="button"
          variant="text"
          size="sm"
          className="mt-2 -ml-2"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "只看最近 3 張" : `看全部 ${studentCards.length} 張`}
        </Button>
      )}
    </div>
  );
};

export default EndedCardsTable;
