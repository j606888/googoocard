import {
  StudentCardWithCard,
  StudentWithDetail,
} from "@/store/slices/students";
import StudentCard from "./StudentCard";
import BuyCard from "./BuyCard";
import { useMemo, useState } from "react";

const CardsSection = ({
  student,
  studentCards,
  isPublic,
}: {
  student: StudentWithDetail;
  studentCards: StudentCardWithCard[];
  isPublic?: boolean;
}) => {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showHistory, setShowHistory] = useState(false);

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
        {!isPublic && <BuyCard student={student} />}
        <div className="w-full p-5 bg-primary-50 text-center rounded-sm font-light">
          你尚未購買卡片
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!isPublic && <BuyCard student={student} />}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((filter) => (
          <button
            key={filter}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${
              activeFilter === filter
                ? "bg-primary-500 border-primary-500 text-white shadow-sm"
                : "bg-white border-gray-300 text-gray-700 hover:border-primary-300"
            }`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter === "all" ? "全部" : filter}
          </button>
        ))}
      </div>
      {filteredActiveCards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredActiveCards.map((studentCard) => (
            <StudentCard
              key={studentCard.id}
              studentCard={studentCard}
              isPublic={isPublic}
            />
          ))}
        </div>
      ) : (
        <div className="w-full p-5 bg-primary-50 text-center rounded-sm font-light">
          目前沒有符合條件的有效課卡
        </div>
      )}
      {!showHistory && filteredHistoricalCards.length > 0 && (
        <button
          className="text-sm text-gray-600 underline text-left cursor-pointer"
          onClick={() => setShowHistory(true)}
        >
          查看已結束/已過期課卡
        </button>
      )}
      {showHistory && filteredHistoricalCards.length > 0 && (
        <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-600">已結束/已過期課卡</p>
          {filteredHistoricalCards.map((studentCard) => (
            <StudentCard
              key={studentCard.id}
              studentCard={studentCard}
              isPublic={isPublic}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CardsSection;
