import { useState } from "react";
import { useGetCardsQuery } from "@/store/slices/cards";
import { CreditCard, ChevronDown } from "lucide-react";
import NewCard from "./NewCard";
import SingleCard from "./SingleCard";
import CardListSkeleton from "./CardListSkeleton";
import EditCard from "./EditCard";

const CardList = () => {
  const { data, isLoading } = useGetCardsQuery();
  const { activeCards, expiredCards } = data || {
    activeCards: [],
    expiredCards: [],
  };
  const [showExpiredCards, setShowExpiredCards] = useState(false);
  const [editCardId, setEditCardId] = useState<number | null>(null);

  if (isLoading) {
    return <CardListSkeleton />;
  }

  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold">Cards</h2>
        <NewCard />
      </div>
      {activeCards?.length === 0 && expiredCards?.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm ">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">No cards yet</p>
            <p className="text-sm text-gray-500 text-center">
              Create your first card to get started.
            </p>
          </div>
        </div>
      )}
      {activeCards?.length > 0 && (
        <>
          <div className="text-gray-600 text-sm mb-3">
            Enabled Cards ({activeCards?.length})
          </div>
          <div className="flex flex-col gap-4 mb-6">
            {activeCards?.map((card) => (
              <SingleCard key={card.id} card={card} onEdit={() => setEditCardId(card.id)} />
            ))}
          </div>
        </>
      )}
      {expiredCards?.length > 0 && (
        <>
          <hr className="border-gray-100 my-6" />
          <button
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors mb-3 cursor-pointer"
            onClick={() => setShowExpiredCards(!showExpiredCards)}
          >
            <span className="text-sm font-medium text-gray-600">
              Disabled Cards ({expiredCards?.length})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                showExpiredCards ? "rotate-180" : ""
              }`}
            />
          </button>
          {showExpiredCards && (
            <div className="flex flex-col gap-4">
              {expiredCards?.map((card) => (
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

export default CardList;
