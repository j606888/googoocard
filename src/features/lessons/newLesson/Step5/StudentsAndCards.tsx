import { Pencil } from "lucide-react";

const cards = [
  {
    name: "丁丁",
    type: "buy-in",
    price: 1000,
    originalPrice: 2000,
    cardName: "6堂(進階)",
  },
  {
    name: "Nora",
    type: "buy-in",
    price: 2000,
    cardName: "6堂(進階)",
    sessionsLeft: 4,
  },
  {
    name: "Emma",
    type: "card-exist",
    cardName: "6堂(進階)",
    sessionsLeft: 1,
  },
  {
    name: "Chorous",
    type: "card-exist",
    cardName: "單堂(進階)",
  },
]
const StudentsAndCards = () => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center border-b-1 border-gray-200 pb-2 mb-2">
        <h3 className="text-base font-bold">Students & Cards</h3>
        <div className="flex items-center gap-2 text-primary-700">
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-medium">Edit</span>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-2">
        {cards.map(card => (
          <Card key={card.name} {...card} />
        ))}
      </div>
    </div>
  );
};

const Card = ({
  name,
  type,
  price,
  originalPrice,
  cardName,
  sessionsLeft,
}: {
  name: string;
  type: string;
  price?: number;
  originalPrice?: number;
  cardName: string;
  sessionsLeft?: number;
}) => {
  return (
    <div className="flex flex-col bg-primary-100 px-3 py-2 gap-2">
      <div className="flex gap-2">
        <h4 className="font-bold">{name}</h4>
        <div
          className={`text-white px-2 py-1 rounded-full text-xs ${
            type === "buy-in" ? "bg-primary-500" : "bg-[#F4A15E]"
          }`}
        >
          {type === "buy-in" ? "Buy in" : "Card exist"}
        </div>
        <div className="ml-auto">
          {originalPrice || price ? (
            <>
            {originalPrice && (
            <span className="text-sm font-medium line-through text-gray-500 mr-1">
              ${originalPrice}
            </span>
          )}
          <span className="text-sm font-medium">${price}</span>
            </>
          ) : (
            <span>-</span>
          )}
          
        </div>
      </div>
      <div className="text-sm text-gray-500">
        <span>{cardName}</span>
        {sessionsLeft && ` - ${sessionsLeft} sessions left`}
      </div>
    </div>
  );
};

export default StudentsAndCards;
