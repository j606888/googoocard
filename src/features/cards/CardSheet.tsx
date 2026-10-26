"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import SideSheet, { SideSheetTitle } from "@/components/SideSheet";
import { Button } from "@/components/ui/button";
import { useGetCardDetailQuery } from "@/store/slices/cards";
import CardDetailBody, { CardDetailSkeleton, cardFromDetail } from "./CardDetail/CardDetailBody";
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
          <Button variant="ghost" size="icon" aria-label="上一個方案" disabled={order.length < 2 || index === -1} onClick={() => go(-1)}>
            <ChevronUp />
          </Button>
          <Button variant="ghost" size="icon" aria-label="下一個方案" disabled={order.length < 2 || index === -1} onClick={() => go(1)}>
            <ChevronDown />
          </Button>
          <span className="w-px h-5 bg-neutral-200 mx-1" />
          <Button variant="ghost" size="icon" aria-label="關閉" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {!detail ? (
          <CardDetailSkeleton />
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
        <Button variant="ghost" size="icon" aria-label="關閉" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <CardFormFields form={form} />
      </div>
      <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-100">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button type="submit" isLoading={form.isLoading} className="flex-[2]">
          {SUBMIT_TEXT[target.mode]}
        </Button>
      </div>
    </form>
  );
};

export default CardSheet;
