import { Card } from "@/store/slices/cards";
import { EllipsisVertical, Trash, Ban, Lightbulb, Pencil, Users } from "lucide-react";
import { useState, useRef } from "react";
import Menu from "@/components/Menu";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  useDeleteCardMutation,
  useExpireCardMutation,
  useEnableCardMutation,
} from "@/store/slices/cards";

const SingleCard = ({ card, onEdit }: { card: Card; onEdit?: () => void }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [deleteCard] = useDeleteCardMutation();
  const [expireCard, { isLoading: isExpiring }] = useExpireCardMutation();
  const [enableCard] = useEnableCardMutation();

  const isDisabled = !!card.expiredAt;
  const perSession = card.sessions > 0 ? Math.round(card.price / card.sessions) : 0;
  const accentClass = card.isPracticeCard ? "border-l-violet-500" : "border-l-primary-500";

  const handleDelete = async () => {
    await deleteCard(card.id);
  };

  const handleExpire = async () => {
    await expireCard(card.id);
    setConfirmDisable(false);
  };

  const handleEnable = async () => {
    await enableCard(card.id);
  };

  const handleEdit = () => {
    setMenuOpen(false);
    onEdit?.();
  };

  return (
    <>
      <div
        className={`border border-gray-200 border-l-4 ${accentClass} rounded-lg p-4 shadow-sm ${
          isDisabled ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col gap-1.5">
            <h4 className="text-base font-semibold leading-none">{card.name}</h4>
            {card.isPracticeCard && (
              <span className="text-xs text-violet-700 bg-violet-100 border border-violet-300 rounded-full px-2.5 py-0.5 w-fit">
                Practice Card
              </span>
            )}
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            ref={buttonRef}
            className="p-1 hover:bg-gray-100 rounded-md cursor-pointer"
          >
            <EllipsisVertical className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Price" value={`$${card.price.toLocaleString()}`} />
          <Stat label="Sessions" value={`${card.sessions}`} />
          <Stat label="Per session" value={`$${perSession.toLocaleString()}`} highlight />
        </div>

        <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {card.activeHolders} active
          </span>
          <span>{card.purchasedCount} purchased</span>
          <span className="font-medium text-gray-700">
            ${card.totalRevenue.toLocaleString()} revenue
          </span>
        </div>
      </div>

      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        {!isDisabled && (
          <button
            className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm cursor-pointer"
            onClick={handleEdit}
          >
            <Pencil className="w-4.5 h-4.5" />
            <span>Edit</span>
          </button>
        )}
        {card.purchasedCount === 0 && (
          <button
            className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm cursor-pointer"
            onClick={handleDelete}
          >
            <Trash className="w-4.5 h-4.5" />
            <span>Delete</span>
          </button>
        )}
        {isDisabled ? (
          <button
            className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm cursor-pointer"
            onClick={handleEnable}
          >
            <Lightbulb className="w-4.5 h-4.5" />
            <span>Enable</span>
          </button>
        ) : (
          <button
            className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm cursor-pointer"
            onClick={() => {
              setMenuOpen(false);
              setConfirmDisable(true);
            }}
          >
            <Ban className="w-4.5 h-4.5" />
            <span>Disable</span>
          </button>
        )}
      </Menu>

      <ConfirmDialog
        open={confirmDisable}
        title="Disable this card?"
        message={`"${card.name}" will no longer be available for new purchases. Existing student cards are not affected.`}
        confirmLabel="Disable"
        onConfirm={handleExpire}
        onCancel={() => setConfirmDisable(false)}
        isLoading={isExpiring}
      />
    </>
  );
};

const Stat = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="flex flex-col items-center">
    <p className={`text-lg font-bold ${highlight ? "text-primary-600" : "text-gray-900"}`}>
      {value}
    </p>
    <p className="text-xs text-gray-400">{label}</p>
  </div>
);

export default SingleCard;
