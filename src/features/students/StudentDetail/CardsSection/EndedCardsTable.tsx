import { useState } from "react";
import type { StudentCardWithCard } from "@/store/slices/students";
import { formatCardSerial } from "@/lib/cardSerial";
import { cardEndReason, cardPeriodLabel } from "./cardStatus";

/** 預設只列這麼多張，其餘收在「再顯示 N 張」後面。 */
const INITIAL_ROWS = 5;

/**
 * 已結束的課卡（用完／停用／已轉換）：一張一列——課卡、使用 x/y、結束原因、期間。
 * 用 container query 依自己的寬度排版：寬的時候四欄表格，窄的時候兩行的列。
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
  const rows = showAll ? studentCards : studentCards.slice(0, INITIAL_ROWS);
  const hiddenCount = studentCards.length - rows.length;

  return (
    <div className="@container">
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div
          className="hidden @md:grid grid-cols-[minmax(0,1.6fr)_80px_minmax(110px,1fr)_minmax(120px,1fr)] gap-3 px-4 py-2 bg-neutral-50 text-xs text-neutral-600"
          aria-hidden="true"
        >
          <span>課卡</span>
          <span>使用</span>
          <span>結束原因</span>
          <span>期間</span>
        </div>
        <ul className="m-0 p-0 list-none">
          {rows.map((card) => {
            const used = card.totalSessions - card.remainingSessions;
            const highlighted = highlightedId === card.id;
            return (
              <li
                key={card.id}
                id={`student-card-${card.id}`}
                className={`border-t first:border-t-0 border-neutral-100 scroll-mt-4 transition-colors duration-500 ${
                  highlighted ? "bg-primary-50" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(card)}
                  className="w-full text-left cursor-pointer hover:bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-700 flex items-center justify-between gap-3 @md:grid @md:grid-cols-[minmax(0,1.6fr)_80px_minmax(110px,1fr)_minmax(120px,1fr)]"
                >
                  <span className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-neutral-900 text-sm">{card.card.name}</span>
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {formatCardSerial(card.serialNumber)}
                    </span>
                  </span>
                  <span className="hidden @md:inline tabular-nums">
                    {used} / {card.totalSessions}
                  </span>
                  <span className="hidden @md:inline">{cardEndReason(card)}</span>
                  <span className="hidden @md:inline text-neutral-500 tabular-nums">{cardPeriodLabel(card)}</span>
                  {/* 窄槽位：右側兩行 */}
                  <span className="@md:hidden shrink-0 text-right text-xs text-neutral-500 leading-snug">
                    <span className="block text-neutral-700">
                      {cardEndReason(card)} · {used}/{card.totalSessions}
                    </span>
                    <span className="block tabular-nums">{cardPeriodLabel(card)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full py-2.5 text-sm font-semibold text-primary-900 hover:bg-neutral-50 cursor-pointer border-t border-neutral-100"
          >
            再顯示 {hiddenCount} 張
          </button>
        )}
      </div>
    </div>
  );
};

export default EndedCardsTable;
