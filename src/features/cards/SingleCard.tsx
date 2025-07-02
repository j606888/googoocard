import { Card } from "@/store/slices/cards";
import { EllipsisVertical, Trash, Ban, Lightbulb } from "lucide-react";
import { useState, useRef } from "react";
import Menu from "@/components/Menu";
import {
  useDeleteCardMutation,
  useExpireCardMutation,
  useEnableCardMutation,
} from "@/store/slices/cards";

const SingleCard = ({ card }: { card: Card }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [deleteCard] = useDeleteCardMutation();
  const [expireCard] = useExpireCardMutation();
  const [enableCard] = useEnableCardMutation();

  const handleDelete = async () => {
    await deleteCard(card.id);
  };

  const handleExpire = async () => {
    await expireCard(card.id);
  };

  const handleEnable = async () => {
    await enableCard(card.id);
  };

  return (
    <>
      <div
        className={`flex flex-col border border-gray-200 rounded-sm p-3 gap-3 shadow-sm ${
          card.expiredAt ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-base font-medium">{card.name}</h4>
          <div className="flex items-center gap-2">
            <div className="border border-primary-300 bg-primary-100 text-primary-900 rounded-full px-3 py-1 text-xs">
              For Sale
            </div>
            <button onClick={() => setMenuOpen(!menuOpen)} ref={buttonRef}>
              <EllipsisVertical className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Block label="Price" value={`${card.price}`} />
          <Block label="Sessions" value={`${card.sessions}`} />
          <Block label="Purchased" value={`${0}`} />
        </div>
      </div>
      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <button
          className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm"
          onClick={handleDelete}
        >
          <Trash className="w-4.5 h-4.5" />
          <span>Delete</span>
        </button>
        {card.expiredAt ? (
          <button
            className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm"
            onClick={handleEnable}
          >
            <Lightbulb className="w-4.5 h-4.5" />
            <span>Enable</span>
          </button>
        ) : (
          <button
            className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm"
            onClick={handleExpire}
          >
            <Ban className="w-4.5 h-4.5" />
            <span>Disable</span>
          </button>
        )}
      </Menu>
    </>
  );
};

const Block = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex flex-col items-center w-20">
      <p className="text-lg font-bold text-black">{value}</p>
      <p className="text-sm font-normal text-[#666666]">{label}</p>
    </div>
  );
};

export default SingleCard;
