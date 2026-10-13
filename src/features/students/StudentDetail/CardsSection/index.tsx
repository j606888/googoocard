import FilterChip from "@/components/FilterChip";
import {
  StudentCardWithCard,
  StudentWithDetail,
} from "@/store/slices/students";
import StudentCard from "./StudentCard";
import BuyCard from "./BuyCard";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

const CardsSection = ({
  student,
  studentCards,
  isPublic,
  showBuy = true,
}: {
  student: StudentWithDetail;
  studentCards: StudentCardWithCard[];
  isPublic?: boolean;
  /** 頁首已經有「購買課卡」時（桌面）就不再放滿寬按鈕。 */
  showBuy?: boolean;
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  // 轉換鏈的跳轉目標：捲過去並短暫高亮。
  const [focusCardId, setFocusCardId] = useState<number | null>(null);

  const jumpToCard = useCallback(
    (studentCardId: number) => {
      const target = studentCards.find((card) => card.id === studentCardId);
      // 目標卡被卡種篩選藏起來的話，先切回「全部」才捲得到。
      if (target && activeFilter !== "all" && target.card.name !== activeFilter) {
        setActiveFilter("all");
      }
      // 轉換鏈可能指向已用完的卡——先把收合的歷史區打開。
      if (target && (target.remainingSessions === 0 || target.expiredAt)) {
        setShowHistory(true);
      }
      setFocusCardId(studentCardId);
    },
    [studentCards, activeFilter]
  );

  useEffect(() => {
    if (focusCardId === null) return;
    document
      .getElementById(`student-card-${focusCardId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = setTimeout(() => setFocusCardId(null), 1600);
    return () => clearTimeout(timer);
  }, [focusCardId]);
  // 依自己的寬度排欄（手機一欄、分割檢視兩欄、寬螢幕更多），不靠呼叫端傳欄數。
  const cardListClass =
    "grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(280px,1fr))]";

  const filterOptions = useMemo(() => {
    const cardNames = [...new Set(studentCards.map((card) => card.card.name))];
    return ["all", ...cardNames];
  }, [studentCards]);

  const activeCards = useMemo(
    () =>
      studentCards.filter(
        (card) => card.remainingSessions > 0 && !card.expiredAt
      ),
    [studentCards]
  );

  const historicalCards = useMemo(
    () =>
      studentCards.filter(
        (card) => card.remainingSessions === 0 || !!card.expiredAt
      ),
    [studentCards]
  );

  const filteredActiveCards = useMemo(
    () =>
      activeCards.filter((card) =>
        activeFilter === "all" ? true : card.card.name === activeFilter
      ),
    [activeCards, activeFilter]
  );

  const filteredHistoricalCards = useMemo(
    () =>
      historicalCards.filter((card) =>
        activeFilter === "all" ? true : card.card.name === activeFilter
      ),
    [historicalCards, activeFilter]
  );

  if (studentCards.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {!isPublic && showBuy && <BuyCard student={student} />}
        <div className="w-full p-6 bg-primary-50 text-primary-700 text-center rounded-2xl text-sm">
          你尚未購買卡片
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!isPublic && showBuy && <BuyCard student={student} />}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((filter) => (
          <FilterChip
            key={filter}
            active={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
          >
            {filter === "all" ? "全部" : filter}
          </FilterChip>
        ))}
      </div>
      {filteredActiveCards.length > 0 ? (
        <div className={cardListClass}>
          {filteredActiveCards.map((studentCard) => (
            <StudentCard
              key={studentCard.id}
              studentCard={studentCard}
              danceLevels={student.danceLevels}
              isPublic={isPublic}
              highlighted={focusCardId === studentCard.id}
              onJumpToCard={isPublic ? undefined : jumpToCard}
            />
          ))}
        </div>
      ) : (
        <div className="w-full p-6 bg-primary-50 text-primary-700 text-center rounded-2xl text-sm">
          目前沒有符合條件的有效課卡
        </div>
      )}
      {filteredHistoricalCards.length > 0 && (
        <div className="flex flex-col gap-3 pt-2 border-t border-neutral-200">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="self-start flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showHistory ? "" : "-rotate-90"}`}
            />
            已用完 / 已過期 · {filteredHistoricalCards.length} 張
          </button>
          {showHistory && (
          <div className={cardListClass}>
          {filteredHistoricalCards.map((studentCard) => (
            <StudentCard
              key={studentCard.id}
              studentCard={studentCard}
              danceLevels={student.danceLevels}
              isPublic={isPublic}
              highlighted={focusCardId === studentCard.id}
              onJumpToCard={isPublic ? undefined : jumpToCard}
            />
          ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CardsSection;
