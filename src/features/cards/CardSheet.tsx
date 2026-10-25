"use client";

import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import SideSheet, { SideSheetTitle } from "@/components/SideSheet";
import { useGetCardDetailQuery } from "@/store/slices/cards";
import CardDetailBody, { cardFromDetail } from "./CardDetail/CardDetailBody";
import CardFormFields from "./CardForm/CardFormFields";
import { FORM_TITLE, SUBMIT_TEXT } from "./CardForm/CardFormDrawer";
import { CardFormTarget, useCardForm } from "./CardForm/useCardForm";

/**
 * 桌面右側抽屜裡現在顯示什麼：某個方案的詳情，或方案表單。
 * 表單記得從哪個方案進來（`returnTo`），取消時回到那個方案而不是整個關掉。
 */
export type CardSheetView =
  | { type: "detail"; id: number }
  | { type: "form"; target: CardFormTarget; returnTo: number | null };

/**
 * 桌面版的課卡詳情：點了價目表上的方案才從右邊滑出來。編輯／複製不另開彈窗，
 * 就在同一個抽屜裡換成表單（疊兩層彈窗會讓人不知道關的是哪一個）。
 */
const CardSheet = ({
  view,
  order,
  onChange,
  onClose,
}: {
  view: CardSheetView | null;
  /** 價目表目前畫面上的順序，給「上一個／下一個」用。 */
  order: number[];
  onChange: (view: CardSheetView) => void;
  onClose: () => void;
}) => (
  <SideSheet open={view !== null} onClose={onClose}>
    {view?.type === "detail" && (
      <DetailPane
        id={view.id}
        order={order}
        onChange={onChange}
        onClose={onClose}
      />
    )}
    {view?.type === "form" && (
      <FormPane
        // 換一個目標就是一份新表單，state 不能沿用
        key={view.target.mode === "new" ? `new-${view.target.danceStyleId ?? ""}` : `${view.target.mode}-${view.target.card.id}`}
        target={view.target}
        onCancel={() => (view.returnTo !== null ? onChange({ type: "detail", id: view.returnTo }) : onClose())}
        onSaved={(id) => onChange({ type: "detail", id })}
        onClose={onClose}
      />
    )}
  </SideSheet>
);

const iconButton =
  "w-10 h-10 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 cursor-pointer disabled:opacity-30 disabled:cursor-default";

const DetailPane = ({
  id,
  order,
  onChange,
  onClose,
}: {
  id: number;
  order: number[];
  onChange: (view: CardSheetView) => void;
  onClose: () => void;
}) => {
  const { data, isFetching } = useGetCardDetailQuery({ id });
  const detail = data?.card.id === id ? data : undefined;
  const index = order.indexOf(id);
  const go = (delta: number) => {
    if (index === -1 || order.length < 2) return;
    onChange({ type: "detail", id: order[(index + delta + order.length) % order.length] });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 pl-6 pr-3 py-2.5 border-b border-neutral-100">
        <SideSheetTitle className="text-[13px] font-normal text-neutral-500">
          {detail ? `方案詳情${index !== -1 ? `・${index + 1} / ${order.length}` : ""}` : "方案詳情"}
        </SideSheetTitle>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="上一個方案" disabled={order.length < 2 || index === -1} onClick={() => go(-1)} className={iconButton}>
            <ChevronUp className="w-4.5 h-4.5" />
          </button>
          <button type="button" aria-label="下一個方案" disabled={order.length < 2 || index === -1} onClick={() => go(1)} className={iconButton}>
            <ChevronDown className="w-4.5 h-4.5" />
          </button>
          <span className="w-px h-5 bg-neutral-200 mx-1" />
          <button type="button" aria-label="關閉" onClick={onClose} className={`${iconButton} w-11 h-11`}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {!detail ? (
          <div className="flex justify-center py-16 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin" aria-label="載入中" />
          </div>
        ) : (
          <div className={isFetching ? "opacity-70 transition-opacity" : ""}>
            <CardDetailBody
              detail={detail}
              onEdit={() =>
                onChange({ type: "form", target: { mode: "edit", card: cardFromDetail(detail) }, returnTo: id })
              }
              onDuplicate={() =>
                onChange({ type: "form", target: { mode: "duplicate", card: cardFromDetail(detail) }, returnTo: id })
              }
              onDeleted={onClose}
            />
          </div>
        )}
      </div>
    </>
  );
};

const FormPane = ({
  target,
  onCancel,
  onSaved,
  onClose,
}: {
  target: CardFormTarget;
  onCancel: () => void;
  onSaved: (id: number) => void;
  onClose: () => void;
}) => {
  const form = useCardForm(target);

  const handleSubmit = async () => {
    const id = await form.submit();
    if (id !== null) onSaved(id);
  };

  return (
    <form
      className="flex flex-col flex-1 min-h-0"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-3 pl-6 pr-3 py-3 border-b border-neutral-100">
        <div className="flex flex-col min-w-0">
          <SideSheetTitle className="text-xl font-bold">{FORM_TITLE[target.mode]}</SideSheetTitle>
          {target.mode !== "new" && (
            <span className="text-[13px] text-neutral-500 truncate">{target.card.name}</span>
          )}
        </div>
        <button type="button" aria-label="關閉" onClick={onClose} className={`${iconButton} w-11 h-11`}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <CardFormFields form={form} />
      </div>
      <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-12 rounded-lg border border-neutral-300 text-[15px] font-semibold text-neutral-900 hover:bg-neutral-50 cursor-pointer"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={form.isLoading}
          className="flex-[2] min-h-12 rounded-lg bg-primary-900 text-white text-[15px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {SUBMIT_TEXT[target.mode]}
          {form.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        </button>
      </div>
    </form>
  );
};

export default CardSheet;
