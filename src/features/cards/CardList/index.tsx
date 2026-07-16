"use client";

import { useState } from "react";
import { DanceType } from "@prisma/client";
import { useGetCardsQuery, Card } from "@/store/slices/cards";
import { CreditCard, ChevronDown, Users, TrendingUp, Ban } from "lucide-react";
import { DANCE_TYPE_META } from "@/lib/danceTypes";
import NewCard from "./NewCard";
import SingleCard from "./SingleCard";
import CardListSkeleton from "./CardListSkeleton";
import EditCard from "./EditCard";
import CardFilters, { CardTypeFilter } from "./CardFilters";

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

  if (isLoading) return <CardListSkeleton />;

  // Stat tiles summarise the whole classroom — computed on the full set, never filtered.
  const totalRevenue = activeCards.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalActiveHolders = activeCards.reduce((sum, c) => sum + c.activeHolders, 0);

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

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold">Cards</h2>
        <NewCard />
      </div>

      {/* Stats bar — desktop only */}
      {(activeCards.length > 0 || expiredCards.length > 0) && (
        <div className="hidden lg:grid lg:grid-cols-4 lg:gap-4 lg:mb-6">
          <StatCard
            icon={<CreditCard className="w-5 h-5 text-primary-500" />}
            label="Active Cards"
            value={activeCards.length}
            bg="bg-primary-50"
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-primary-500" />}
            label="Active Holders"
            value={totalActiveHolders}
            bg="bg-primary-50"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-warning-600" />}
            label="Total Revenue"
            display={`$${totalRevenue.toLocaleString()}`}
            bg="bg-warning-100"
          />
          <StatCard
            icon={<Ban className="w-5 h-5 text-neutral-400" />}
            label="Disabled Cards"
            value={expiredCards.length}
            bg="bg-neutral-50"
          />
        </div>
      )}

      {hasAnyCard && (
        <CardFilters
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          danceFilter={danceFilter}
          setDanceFilter={setDanceFilter}
          availableDanceTypes={availableDanceTypes}
        />
      )}

      {!hasAnyCard && (
        <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">No cards yet</p>
            <p className="text-sm text-neutral-500 text-center">
              Create your first card to get started.
            </p>
          </div>
        </div>
      )}

      {hasAnyCard && !hasFilteredMatch && (
        <div className="flex flex-col items-center justify-center p-8 gap-1 bg-neutral-50 rounded-xl">
          <p className="text-base font-semibold text-neutral-700">No matching cards</p>
          <p className="text-sm text-neutral-500 text-center">
            Try a different type or dance filter.
          </p>
        </div>
      )}

      {filteredActive.length > 0 && (
        <>
          <div className="text-neutral-600 text-sm mb-3">
            Enabled Cards ({filteredActive.length})
          </div>
          <div className="flex flex-col gap-4 mb-6 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {filteredActive.map((card) => (
              <SingleCard key={card.id} card={card} onEdit={() => setEditCardId(card.id)} />
            ))}
          </div>
        </>
      )}

      {filteredExpired.length > 0 && (
        <>
          <hr className="border-neutral-100 my-6" />
          <button
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors mb-3 cursor-pointer"
            onClick={() => setShowExpiredCards(!showExpiredCards)}
          >
            <span className="text-sm font-medium text-neutral-600">
              Disabled Cards ({filteredExpired.length})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${
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

const StatCard = ({
  icon,
  label,
  value,
  display,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  display?: string;
  bg: string;
}) => (
  <div className={`${bg} border border-neutral-100 rounded-xl p-4 flex items-center gap-3 shadow-sm`}>
    <div className="shrink-0">{icon}</div>
    <div>
      <p className="text-2xl font-bold text-neutral-900">{display ?? value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  </div>
);

export default CardList;
