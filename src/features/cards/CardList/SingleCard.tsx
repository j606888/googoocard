import { Card } from "@/store/slices/cards";
import { EllipsisVertical, Trash, Ban, Lightbulb, Pencil, Users, TriangleAlert, Info } from "lucide-react";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";
import { useState, useRef } from "react";
import Link from "next/link";
import Menu from "@/components/Menu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/utils";
import { perSessionPrice } from "../cardInsights";
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
  const perSession = perSessionPrice(card);
  const accentClass = card.isPracticeCard ? "border-l-warning-500" : "border-l-primary-500";

  // 整張卡是連結，所以卡內每個按鈕都得自己擋下導頁。
  const stopNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    await deleteCard(card.id);
  };

  const handleExpire = async () => {
    await expireCard(card.id);
    setConfirmDisable(false);
  };

  const handleEnable = async () => {
    setMenuOpen(false);
    await enableCard(card.id);
  };

  const handleEdit = () => {
    setMenuOpen(false);
    onEdit?.();
  };

  return (
    <>
      <Link
        href={`/cards/${card.id}`}
        className={`block border border-neutral-200 border-l-4 ${accentClass} rounded-lg p-4 shadow-sm transition-all hover:shadow-md hover:border-neutral-300 ${
          isDisabled ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h4 className="text-[17px] font-semibold leading-tight">{card.name}</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              {card.isPracticeCard ? (
                <span className="text-xs text-warning-900 bg-warning-100 border border-warning-300 rounded-full px-2.5 py-0.5 w-fit">
                  複習卡
                </span>
              ) : (
                <span className="text-xs text-neutral-600 bg-neutral-100 rounded-full px-2.5 py-0.5 w-fit">
                  一般卡
                </span>
              )}
              {card.danceType ? (
                <span className={`text-xs rounded-full px-2.5 py-0.5 w-fit ${DANCE_TYPE_META[card.danceType].badge}`}>
                  {danceTypeLabel(card.danceType)}
                </span>
              ) : (
                card.isPracticeCard && (
                  <span className="flex items-center gap-1 text-xs text-warning-700 bg-warning-100 border border-warning-300 rounded-full px-2.5 py-0.5 w-fit">
                    <TriangleAlert className="w-3 h-3" />
                    缺少舞種
                  </span>
                )
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              stopNavigation(e);
              setMenuOpen(!menuOpen);
            }}
            ref={buttonRef}
            aria-label="更多操作"
            className="shrink-0 flex items-center justify-center w-8 h-8 -mr-1.5 -mt-1 hover:bg-neutral-100 rounded-md cursor-pointer"
          >
            <EllipsisVertical className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="flex items-baseline justify-between gap-2 mt-3.5">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[22px] font-bold tracking-tight">
              ${card.price.toLocaleString()}
            </span>
            <span className="text-[13px] text-neutral-500">/ {card.sessions} 堂</span>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-primary-700 bg-primary-100 rounded-full px-2.5 py-1">
            單堂 ${perSession.toLocaleString()}
          </span>
        </div>

        <div className="border-t border-neutral-100 mt-3.5 pt-3 flex items-center justify-between gap-2">
          {card.purchasedCount === 0 ? (
            <>
              <span className="flex items-center gap-1.5 text-[13px] text-neutral-400">
                <Info className="w-3.5 h-3.5" />
                還沒有人購買過
              </span>
              <span className="text-xs text-neutral-300">
                建立於 {formatDate(card.createdAt, "M/d")}
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-700">
                <Users className="w-3.5 h-3.5 text-neutral-600" />
                {card.activeHolders} 人持卡中
              </span>
              <span className="text-xs text-neutral-400">
                售出 {card.purchasedCount} · ${card.totalRevenue.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </Link>

      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        {!isDisabled && (
          <button
            className="flex gap-2 items-center p-3 hover:bg-neutral-100 rounded-sm cursor-pointer"
            onClick={handleEdit}
          >
            <Pencil className="w-4.5 h-4.5" />
            <span>編輯</span>
          </button>
        )}
        {card.purchasedCount === 0 && (
          <button
            className="flex gap-2 items-center p-3 hover:bg-neutral-100 rounded-sm cursor-pointer"
            onClick={handleDelete}
          >
            <Trash className="w-4.5 h-4.5" />
            <span>刪除</span>
          </button>
        )}
        {isDisabled ? (
          <button
            className="flex gap-2 items-center p-3 hover:bg-neutral-100 rounded-sm cursor-pointer"
            onClick={handleEnable}
          >
            <Lightbulb className="w-4.5 h-4.5" />
            <span>啟用</span>
          </button>
        ) : (
          <button
            className="flex gap-2 items-center p-3 hover:bg-neutral-100 rounded-sm cursor-pointer"
            onClick={() => {
              setMenuOpen(false);
              setConfirmDisable(true);
            }}
          >
            <Ban className="w-4.5 h-4.5" />
            <span>停用</span>
          </button>
        )}
      </Menu>

      <ConfirmDialog
        open={confirmDisable}
        title="停用這張卡片？"
        message={`「${card.name}」之後無法再被購買，已發出的學生課卡不受影響。`}
        confirmLabel="停用"
        onConfirm={handleExpire}
        onCancel={() => setConfirmDisable(false)}
        isLoading={isExpiring}
      />
    </>
  );
};

export default SingleCard;
