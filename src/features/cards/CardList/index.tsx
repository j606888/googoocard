"use client";

import { useState } from "react";
import { DanceType } from "@prisma/client";
import { useGetCardsQuery, Card } from "@/store/slices/cards";
import { CreditCard, ChevronDown, Ban } from "lucide-react";
import { DANCE_TYPE_META } from "@/lib/danceTypes";
import SortMenu from "@/components/SortMenu";
import NewCard from "./NewCard";
import SingleCard from "./SingleCard";
import CardListSkeleton from "./CardListSkeleton";
import EditCard from "./EditCard";
import CardFilters, { CardTypeFilter } from "./CardFilters";
import {
  CARD_SORT_OPTIONS,
  CardSort,
  DEFAULT_CARD_SORT,
  cardsSummary,
  sortCards,
  splitByType,
} from "../cardInsights";

const DANCE_TYPE_ORDER = Object.keys(DANCE_TYPE_META) as DanceType[];

const CardList = () => {
  const { data, isLoading } = useGetCardsQuery();
  const { activeCards, expiredCards } = data || {
    activeCards: [],
    expiredCards: [],
  };
  const [showExpiredCards, setShowExpiredCards] = useState(false);
  const [editCardId, setEditCardId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<CardTypeFilter>("all");
  const [danceFilter, setDanceFilter] = useState<DanceType | null>(null);
  const [sort, setSort] = useState<CardSort>(DEFAULT_CARD_SORT);

  if (isLoading) return <CardListSkeleton />;

  // Dance types with at least one card (active or disabled), in canonical order.
  const availableDanceTypes = DANCE_TYPE_ORDER.filter((t) =>
    [...activeCards, ...expiredCards].some((c) => c.danceType === t)
  );

  const matchesFilters = (card: Card) => {
    const typeOk =
      typeFilter === "all" ||
      (typeFilter === "practice" ? card.isPracticeCard : !card.isPracticeCard);
    const danceOk = danceFilter === null || card.danceType === danceFilter;
    return typeOk && danceOk;
  };

  const hasAnyCard = activeCards.length > 0 || expiredCards.length > 0;
  const filteredActive = activeCards.filter(matchesFilters);
  const filteredExpired = expiredCards.filter(matchesFilters);
  const hasFilteredMatch = filteredActive.length > 0 || filteredExpired.length > 0;

  const summary = cardsSummary(activeCards);
  // 分組固定（一般卡在上、複習卡在下），排序只改變組內順序。
  const { general, practice } = splitByType(sortCards(filteredActive, sort));
  // 已經用「類型」篩到單一組時就不必再多一層組標題。
  const showGroupHeadings = typeFilter === "all";

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold">課卡</h2>
          {/* 用間距而不是「·」分隔——換行時分隔點會落在行尾。 */}
          {hasAnyCard && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[13px] text-neutral-500">
              <span>
                啟用中 <b className="font-semibold text-neutral-900">{summary.kinds}</b> 種
              </span>
              <span>
                使用中的課卡{" "}
                <b className="font-semibold text-neutral-900">
                  {summary.activeStudentCards}
                </b>{" "}
                張
              </span>
              <span>
                累積課卡收入{" "}
                <b className="font-semibold text-neutral-900">
                  ${summary.totalRevenue.toLocaleString()}
                </b>
              </span>
            </div>
          )}
        </div>
        <NewCard />
      </div>

      {hasAnyCard && (
        <CardFilters
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          danceFilter={danceFilter}
          setDanceFilter={setDanceFilter}
          availableDanceTypes={availableDanceTypes}
          sortMenu={
            <SortMenu sort={sort} options={CARD_SORT_OPTIONS} onChange={setSort} />
          }
        />
      )}

      {!hasAnyCard && (
        <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">還沒有課卡</p>
            <p className="text-sm text-neutral-500 text-center">
              建立第一張課卡就可以開始了。
            </p>
          </div>
        </div>
      )}

      {hasAnyCard && !hasFilteredMatch && (
        <div className="flex flex-col items-center justify-center p-8 gap-1 bg-neutral-50 rounded-xl">
          <p className="text-base font-semibold text-neutral-700">沒有符合的課卡</p>
          <p className="text-sm text-neutral-500 text-center">
            換個類型或舞種篩選再試試。
          </p>
        </div>
      )}

      {general.length > 0 && (
        <CardGroup
          cards={general}
          onEdit={setEditCardId}
          heading={showGroupHeadings ? "一般課卡" : undefined}
          dotClass="bg-primary-500"
        />
      )}

      {practice.length > 0 && (
        <CardGroup
          cards={practice}
          onEdit={setEditCardId}
          heading={showGroupHeadings ? "複習卡" : undefined}
          hint="僅限有該舞種 Lv1 資格的學生購買"
          dotClass="bg-warning-500"
        />
      )}

      {filteredExpired.length > 0 && (
        <>
          <hr className="border-neutral-100 my-6" />
          <button
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors mb-3 cursor-pointer"
            onClick={() => setShowExpiredCards(!showExpiredCards)}
          >
            <span className="flex items-center gap-2 min-w-0 text-left">
              <Ban className="w-4 h-4 shrink-0 text-neutral-400" />
              <span className="text-sm font-medium text-neutral-600 shrink-0">
                已停用的課卡 {filteredExpired.length} 種
              </span>
              <span className="hidden sm:inline text-xs text-neutral-400 truncate">
                不能再購買，已發出的學生課卡不受影響
              </span>
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
                showExpiredCards ? "rotate-180" : ""
              }`}
            />
          </button>
          {showExpiredCards && (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
              {filteredExpired.map((card) => (
                <SingleCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </>
      )}

      {editCardId && <EditCard cardId={editCardId} onClose={() => setEditCardId(null)} />}
    </div>
  );
};

const CardGroup = ({
  cards,
  heading,
  hint,
  dotClass,
  onEdit,
}: {
  cards: Card[];
  heading?: string;
  hint?: string;
  dotClass: string;
  onEdit: (id: number) => void;
}) => (
  <div className="mb-6">
    {heading && (
      <div className="flex items-baseline flex-wrap gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <h3 className="text-sm font-semibold text-neutral-700">{heading}</h3>
        <span className="text-[13px] text-neutral-400">
          {cards.length} 種{hint ? ` · ${hint}` : ""}
        </span>
      </div>
    )}
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
      {cards.map((card) => (
        <SingleCard key={card.id} card={card} onEdit={() => onEdit(card.id)} />
      ))}
    </div>
  </div>
);

export default CardList;
